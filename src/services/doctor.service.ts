import { AppError, AuthUser, AvailabilityWindow } from '../types';
import { DoctorRepository } from '../repositories/doctor.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { UserRepository } from '../repositories/user.repository';
import { hashPassword } from '../utils/password';
import { dayOfWeekFromDate, generateSlots } from '../utils/helpers';
import { writeAuditLog } from '../utils/audit';
import { assertHospitalScope, requireHospitalId, tenantFilter } from '../utils/tenant';

const doctorRepository = new DoctorRepository();
const appointmentRepository = new AppointmentRepository();
const userRepository = new UserRepository();

const WEEKDAY_HOURS: AvailabilityWindow[] = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: '09:00',
  endTime: '17:00',
  slotMinutes: 30,
}));

export class DoctorService {
  async list(authUser: AuthUser) {
    if (authUser.role === 'DOCTOR') {
      const own = await doctorRepository.findByUserId(authUser.id);
      return own ? [own] : [];
    }
    return doctorRepository.list(tenantFilter(authUser));
  }

  async getById(id: string, authUser: AuthUser) {
    const doctor = await doctorRepository.findById(id);
    if (!doctor) {
      throw new AppError('Doctor not found', 404);
    }
    assertHospitalScope(doctor, authUser);
    return doctor;
  }

  async getOwn(authUser: AuthUser) {
    const doctor = await doctorRepository.findByUserId(authUser.id);
    if (!doctor) {
      throw new AppError('Doctor profile not found', 404);
    }
    assertHospitalScope(doctor, authUser);
    return doctor;
  }

  async create(input: Record<string, unknown>, authUser: AuthUser, ipAddress?: string) {
    const hospitalId = requireHospitalId(authUser);
    const email = String(input.email ?? '').toLowerCase();
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError('An account with this email already exists', 409);
    }

    const user = await userRepository.create({
      hospitalId: hospitalId as never,
      email,
      passwordHash: await hashPassword(String(input.password ?? 'ChangeMe!123')),
      role: 'DOCTOR',
      firstName: String(input.firstName),
      lastName: String(input.lastName),
      isActive: true,
    });

    const doctor = await doctorRepository.create({
      hospitalId: hospitalId as never,
      userId: user._id,
      specialization: String(input.specialization),
      department: String(input.department),
      consultationFee: Number(input.consultationFee),
      licenseNumber: String(input.licenseNumber),
      bio: input.bio ? String(input.bio) : undefined,
      availability: (input.availability as AvailabilityWindow[]) ?? WEEKDAY_HOURS,
    });

    await writeAuditLog({
      hospitalId,
      userId: authUser.id,
      role: authUser.role,
      actionType: 'DOCTOR_CREATE',
      resource: 'Doctor',
      resourceId: String(doctor._id),
      ipAddress,
    });

    return doctorRepository.findById(String(doctor._id));
  }

  async update(id: string, input: Record<string, unknown>, authUser: AuthUser, ipAddress?: string) {
    await this.getById(id, authUser);
    const updated = await doctorRepository.updateById(id, {
      specialization: input.specialization ? String(input.specialization) : undefined,
      department: input.department ? String(input.department) : undefined,
      consultationFee:
        input.consultationFee !== undefined ? Number(input.consultationFee) : undefined,
      bio: input.bio ? String(input.bio) : undefined,
      availability: input.availability as AvailabilityWindow[] | undefined,
    });

    await writeAuditLog({
      hospitalId: requireHospitalId(authUser),
      userId: authUser.id,
      role: authUser.role,
      actionType: 'DOCTOR_UPDATE',
      resource: 'Doctor',
      resourceId: id,
      ipAddress,
    });

    return updated;
  }

  async availability(doctorId: string, date: string, authUser: AuthUser) {
    const doctor = await this.getById(doctorId, authUser);
    const day = dayOfWeekFromDate(date);
    const windows = doctor.availability.filter(
      (window: AvailabilityWindow) => window.dayOfWeek === day,
    );
    const allSlots = windows.flatMap((window: AvailabilityWindow) =>
      generateSlots(window.startTime, window.endTime, window.slotMinutes),
    );
    const booked = await appointmentRepository.listBookedSlots(requireHospitalId(authUser), doctorId, date);
    const taken = new Set(booked.map((item) => item.timeSlot));

    return {
      date,
      doctorId,
      consultationFee: doctor.consultationFee,
      slotMinutes: windows[0]?.slotMinutes ?? 30,
      slots: allSlots.map((time: string) => ({
        time,
        available: !taken.has(time),
      })),
    };
  }
}
