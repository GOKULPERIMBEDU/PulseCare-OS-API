import { AppError, AuthUser, MedicationItem } from '../types';
import { PrescriptionRepository } from '../repositories/prescription.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { writeAuditLog } from '../utils/audit';
import { assertHospitalScope, tenantFilter } from '../utils/tenant';

const prescriptionRepository = new PrescriptionRepository();
const appointmentRepository = new AppointmentRepository();
const doctorRepository = new DoctorRepository();
const patientRepository = new PatientRepository();

export class PrescriptionService {
  async list(authUser: AuthUser, patientId?: string) {
    const filter: Record<string, unknown> = { ...tenantFilter(authUser) };
    if (authUser.role === 'PATIENT') {
      const patient = await patientRepository.findByUserId(authUser.id);
      if (!patient) return [];
      filter.patientId = patient._id;
    } else if (patientId) {
      filter.patientId = patientId;
    }
    if (authUser.role === 'DOCTOR') {
      const doctor = await doctorRepository.findByUserId(authUser.id);
      if (doctor) filter.doctorId = doctor._id;
    }
    return prescriptionRepository.list(filter);
  }

  async create(
    input: { appointmentId: string; medications: MedicationItem[]; notes?: string },
    authUser: AuthUser,
    ipAddress?: string,
  ) {
    if (authUser.role !== 'DOCTOR' && authUser.role !== 'HOSPITAL_ADMIN') {
      throw new AppError('Only clinicians can issue prescriptions', 403);
    }
    if (!input.medications?.length) {
      throw new AppError('At least one medication is required', 400);
    }

    const appointment = await appointmentRepository.findById(input.appointmentId);
    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }
    assertHospitalScope(appointment, authUser);

    const existing = await prescriptionRepository.findByAppointmentId(input.appointmentId);
    if (existing) {
      throw new AppError('A prescription already exists for this appointment', 409);
    }

    const doctorId =
      typeof appointment.doctorId === 'object' && appointment.doctorId && '_id' in (appointment.doctorId as object)
        ? String((appointment.doctorId as { _id: unknown })._id)
        : String(appointment.doctorId);
    const patientId =
      typeof appointment.patientId === 'object' && appointment.patientId && '_id' in (appointment.patientId as object)
        ? String((appointment.patientId as { _id: unknown })._id)
        : String(appointment.patientId);

    if (authUser.role === 'DOCTOR') {
      const doctor = await doctorRepository.findByUserId(authUser.id);
      if (!doctor || String(doctor._id) !== doctorId) {
        throw new AppError('You can only prescribe for your own appointments', 403);
      }
    }

    const prescription = await prescriptionRepository.create({
      hospitalId: authUser.hospitalId as never,
      appointmentId: appointment._id,
      doctorId: doctorId as never,
      patientId: patientId as never,
      medications: input.medications,
      notes: input.notes,
      issuedAt: new Date(),
    });

    await writeAuditLog({
      hospitalId: authUser.hospitalId,
      userId: authUser.id,
      role: authUser.role,
      actionType: 'PRESCRIPTION_CREATE',
      resource: 'Prescription',
      resourceId: String(prescription._id),
      metadata: { appointmentId: input.appointmentId },
      ipAddress,
    });

    return prescriptionRepository.findById(String(prescription._id));
  }
}
