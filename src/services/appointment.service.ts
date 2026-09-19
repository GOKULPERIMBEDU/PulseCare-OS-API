import { AppError, AppointmentStatus, AuthUser, AvailabilityWindow } from '../types';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { addMinutes, dayOfWeekFromDate, todayDateString } from '../utils/helpers';
import { writeAuditLog } from '../utils/audit';
import { emitQueueUpdate } from '../sockets/emitter';
import { assertHospitalScope, requireHospitalId, tenantFilter } from '../utils/tenant';

const appointmentRepository = new AppointmentRepository();
const doctorRepository = new DoctorRepository();
const patientRepository = new PatientRepository();

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  Scheduled: ['Waiting', 'Cancelled'],
  Waiting: ['In-Consultation', 'Cancelled'],
  'In-Consultation': ['Completed', 'Waiting'],
  Completed: [],
  Cancelled: [],
};

export class AppointmentService {
  async list(authUser: AuthUser, query: { date?: string; doctorId?: string; patientId?: string }) {
    const filter: Record<string, unknown> = { ...tenantFilter(authUser) };
    if (query.date) filter.date = query.date;
    if (query.doctorId) filter.doctorId = query.doctorId;
    if (query.patientId) filter.patientId = query.patientId;

    if (authUser.role === 'PATIENT') {
      const patient = await patientRepository.findByUserId(authUser.id);
      if (!patient) return [];
      filter.patientId = patient._id;
    }
    if (authUser.role === 'DOCTOR') {
      const doctor = await doctorRepository.findByUserId(authUser.id);
      if (!doctor) return [];
      filter.doctorId = doctor._id;
    }

    return appointmentRepository.list(filter);
  }

  async getById(id: string, authUser: AuthUser) {
    const appointment = await appointmentRepository.findById(id);
    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }
    assertHospitalScope(appointment, authUser);
    await this.assertCanAccess(appointment, authUser);
    return appointment;
  }

  async create(
    input: {
      patientId?: string;
      doctorId: string;
      date: string;
      timeSlot: string;
      reason: string;
      notes?: string;
    },
    authUser: AuthUser,
    ipAddress?: string,
  ) {
    const hospitalId = requireHospitalId(authUser);
    const patientId = await this.resolvePatientId(input.patientId, authUser);
    const doctor = await doctorRepository.findById(input.doctorId);
    if (!doctor) {
      throw new AppError('Doctor not found', 404);
    }
    assertHospitalScope(doctor, authUser);
    this.assertValidSlot(doctor.availability, input.date, input.timeSlot);
    await this.assertNoConflict(hospitalId, input.doctorId, input.date, input.timeSlot);

    const slotMinutes =
      doctor.availability.find(
        (window: AvailabilityWindow) => window.dayOfWeek === dayOfWeekFromDate(input.date),
      )?.slotMinutes ?? 30;

    const appointment = await appointmentRepository.create({
      hospitalId: hospitalId as never,
      patientId: patientId as never,
      doctorId: doctor._id,
      date: input.date,
      timeSlot: input.timeSlot,
      endTime: addMinutes(input.timeSlot, slotMinutes),
      reason: input.reason,
      notes: input.notes,
      status: 'Scheduled',
      createdBy: authUser.id as never,
    });

    await writeAuditLog({
      hospitalId,
      userId: authUser.id,
      role: authUser.role,
      actionType: 'APPOINTMENT_CREATE',
      resource: 'Appointment',
      resourceId: String(appointment._id),
      metadata: { doctorId: input.doctorId, date: input.date, timeSlot: input.timeSlot },
      ipAddress,
    });

    const populated = await appointmentRepository.findById(String(appointment._id));
    await this.broadcastQueue(hospitalId);
    return populated;
  }

  async updateStatus(id: string, status: AppointmentStatus, authUser: AuthUser, ipAddress?: string) {
    const appointment = await this.getById(id, authUser);
    const current = appointment.status as AppointmentStatus;
    if (!TRANSITIONS[current].includes(status)) {
      throw new AppError(`Cannot move appointment from ${current} to ${status}`, 400);
    }

    if (status === 'In-Consultation') {
      const active = await appointmentRepository.list({
        hospitalId: requireHospitalId(authUser),
        doctorId: appointment.doctorId,
        date: appointment.date,
        status: 'In-Consultation',
        _id: { $ne: appointment._id },
      });
      if (active.length > 0) {
        throw new AppError('This doctor already has a patient in consultation', 409);
      }
    }

    const patch: Record<string, unknown> = { status };
    if (status === 'Waiting') patch.checkedInAt = new Date();
    if (status === 'In-Consultation') patch.startedAt = new Date();
    if (status === 'Completed') patch.completedAt = new Date();

    const updated = await appointmentRepository.updateById(id, patch);
    await writeAuditLog({
      hospitalId: authUser.hospitalId,
      userId: authUser.id,
      role: authUser.role,
      actionType: 'APPOINTMENT_STATUS',
      resource: 'Appointment',
      resourceId: id,
      metadata: { from: current, to: status },
      ipAddress,
    });

    await this.broadcastQueue(requireHospitalId(authUser));
    return updated;
  }

  async queue(hospitalId: string, date = todayDateString(), doctorId?: string) {
    const filter: Record<string, unknown> = {
      hospitalId,
      date,
      status: { $in: ['Scheduled', 'Waiting', 'In-Consultation', 'Completed'] },
    };
    if (doctorId) filter.doctorId = doctorId;
    return appointmentRepository.list(filter);
  }

  async broadcastQueue(hospitalId: string, date = todayDateString()): Promise<void> {
    const queue = await this.queue(hospitalId, date);
    emitQueueUpdate({ hospitalId, date, queue });
  }

  private async resolvePatientId(patientId: string | undefined, authUser: AuthUser): Promise<string> {
    if (authUser.role === 'PATIENT') {
      const patient = await patientRepository.findByUserId(authUser.id);
      if (!patient) {
        throw new AppError('Patient profile not found', 404);
      }
      return String(patient._id);
    }
    if (!patientId) {
      throw new AppError('patientId is required', 400);
    }
    const patient = await patientRepository.findById(patientId);
    if (!patient) {
      throw new AppError('Patient not found', 404);
    }
    assertHospitalScope(patient, authUser);
    return String(patient._id);
  }

  private assertValidSlot(
    availability: { dayOfWeek: number; startTime: string; endTime: string; slotMinutes: number }[],
    date: string,
    timeSlot: string,
  ): void {
    const day = dayOfWeekFromDate(date);
    const window = availability.find(
      (item) =>
        item.dayOfWeek === day && timeSlot >= item.startTime && addMinutes(timeSlot, item.slotMinutes) <= item.endTime,
    );
    if (!window) {
      throw new AppError('Selected time is outside the doctor availability schedule', 400);
    }
  }

  private async assertNoConflict(hospitalId: string, doctorId: string, date: string, timeSlot: string): Promise<void> {
    const clash = await appointmentRepository.findConflict(hospitalId, doctorId, date, timeSlot);
    if (clash) {
      throw new AppError('This doctor is already booked for the selected time slot', 409);
    }
  }

  private async assertCanAccess(
    appointment: { patientId: unknown; doctorId: unknown },
    authUser: AuthUser,
  ): Promise<void> {
    if (authUser.role === 'HOSPITAL_ADMIN' || authUser.role === 'SUPER_ADMIN') return;
    if (authUser.role === 'DOCTOR') {
      const doctor = await doctorRepository.findByUserId(authUser.id);
      const doctorId =
        typeof appointment.doctorId === 'object' && appointment.doctorId && '_id' in (appointment.doctorId as object)
          ? String((appointment.doctorId as { _id: unknown })._id)
          : String(appointment.doctorId);
      if (!doctor || String(doctor._id) !== doctorId) {
        throw new AppError('You can only manage your own appointments', 403);
      }
    }
    if (authUser.role === 'PATIENT') {
      const patient = await patientRepository.findByUserId(authUser.id);
      const patientId =
        typeof appointment.patientId === 'object' && appointment.patientId && '_id' in (appointment.patientId as object)
          ? String((appointment.patientId as { _id: unknown })._id)
          : String(appointment.patientId);
      if (!patient || String(patient._id) !== patientId) {
        throw new AppError('You can only access your own appointments', 403);
      }
    }
  }
}
