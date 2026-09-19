import { AppError, AuthUser } from '../types';
import { PatientRepository } from '../repositories/patient.repository';
import { UserRepository } from '../repositories/user.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { hashPassword } from '../utils/password';
import { generateMrn } from '../utils/helpers';
import { writeAuditLog } from '../utils/audit';
import { assertHospitalScope, requireHospitalId, tenantFilter } from '../utils/tenant';

const patientRepository = new PatientRepository();
const userRepository = new UserRepository();
const appointmentRepository = new AppointmentRepository();
const doctorRepository = new DoctorRepository();

export class PatientService {
  async list(authUser: AuthUser) {
    if (authUser.role === 'PATIENT') {
      const own = await patientRepository.findByUserId(authUser.id);
      return own ? [own] : [];
    }
    if (authUser.role === 'DOCTOR') {
      return this.listAssignedPatients(authUser);
    }
    return patientRepository.list(tenantFilter(authUser));
  }

  async getById(id: string, authUser: AuthUser) {
    const patient = await patientRepository.findById(id);
    if (!patient) {
      throw new AppError('Patient not found', 404);
    }
    assertHospitalScope(patient, authUser);
    await this.assertCanAccess(patient, authUser);
    return patient;
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
      role: 'PATIENT',
      firstName: String(input.firstName),
      lastName: String(input.lastName),
      isActive: true,
    });

    const patient = await patientRepository.create({
      hospitalId: hospitalId as never,
      userId: user._id,
      mrn: generateMrn(),
      dateOfBirth: new Date(String(input.dateOfBirth)),
      gender: input.gender as 'female' | 'male' | 'other' | 'undisclosed',
      bloodGroup: input.bloodGroup ? String(input.bloodGroup) : undefined,
      phone: String(input.phone),
      address: input.address as never,
      emergencyContacts: (input.emergencyContacts as never) ?? [],
      medicalHistory: (input.medicalHistory as never) ?? [],
      allergies: (input.allergies as string[]) ?? [],
      chronicConditions: (input.chronicConditions as string[]) ?? [],
    });

    await writeAuditLog({
      hospitalId,
      userId: authUser.id,
      role: authUser.role,
      actionType: 'PATIENT_CREATE',
      resource: 'Patient',
      resourceId: String(patient._id),
      ipAddress,
    });

    return patientRepository.findById(String(patient._id));
  }

  async update(id: string, input: Record<string, unknown>, authUser: AuthUser, ipAddress?: string) {
    const patient = await this.getById(id, authUser);
    const updated = await patientRepository.updateById(id, {
      phone: input.phone ? String(input.phone) : patient.phone,
      bloodGroup: input.bloodGroup ? String(input.bloodGroup) : patient.bloodGroup,
      address: (input.address as never) ?? patient.address,
      emergencyContacts: (input.emergencyContacts as never) ?? patient.emergencyContacts,
      medicalHistory: (input.medicalHistory as never) ?? patient.medicalHistory,
      allergies: (input.allergies as string[]) ?? patient.allergies,
      chronicConditions: (input.chronicConditions as string[]) ?? patient.chronicConditions,
    });

    await writeAuditLog({
      hospitalId: requireHospitalId(authUser),
      userId: authUser.id,
      role: authUser.role,
      actionType: 'PATIENT_UPDATE',
      resource: 'Patient',
      resourceId: id,
      ipAddress,
    });

    return updated;
  }

  private async assertCanAccess(patient: { _id?: unknown; userId: unknown; hospitalId?: unknown }, authUser: AuthUser): Promise<void> {
    if (authUser.role === 'HOSPITAL_ADMIN' || authUser.role === 'SUPER_ADMIN') {
      return;
    }
    if (authUser.role === 'DOCTOR') {
      const doctor = await doctorRepository.findByUserId(authUser.id);
      if (!doctor) {
        throw new AppError('Doctor profile not found', 403);
      }
      const linked = await appointmentRepository.list({
        ...tenantFilter(authUser),
        doctorId: doctor._id,
        patientId: patient._id,
      });
      if (linked.length === 0) {
        throw new AppError('You can only access patients assigned to you', 403);
      }
      return;
    }
    const userId =
      typeof patient.userId === 'object' && patient.userId && '_id' in (patient.userId as object)
        ? String((patient.userId as { _id: unknown })._id)
        : String(patient.userId);
    if (userId !== authUser.id) {
      throw new AppError('You can only access your own medical record', 403);
    }
  }

  private async listAssignedPatients(authUser: AuthUser) {
    const doctor = await doctorRepository.findByUserId(authUser.id);
    if (!doctor) return [];
    const appointments = await appointmentRepository.list({
      ...tenantFilter(authUser),
      doctorId: doctor._id,
    });
    const ids = [
      ...new Set(
        appointments.map((item) =>
          typeof item.patientId === 'object' && item.patientId && '_id' in item.patientId
            ? String((item.patientId as { _id: unknown })._id)
            : String(item.patientId),
        ),
      ),
    ];
    if (ids.length === 0) return [];
    return patientRepository.list({ ...tenantFilter(authUser), _id: { $in: ids } });
  }
}
