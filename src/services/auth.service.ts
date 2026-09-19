import { AuthUser, AppError, Address, BaseCurrency, isSuperAdmin } from '../types';
import { PatientRepository } from '../repositories/patient.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { UserRepository } from '../repositories/user.repository';
import { HospitalRepository } from '../repositories/hospital.repository';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken } from '../utils/token';
import { writeAuditLog } from '../utils/audit';
import { generateMrn } from '../utils/helpers';
import { slugifyHospitalName } from '../utils/tenant';
import { HospitalDocument } from '../models/hospital.model';
import { PlatformService } from './platform.service';
import { SEED_ACCOUNT_PASSWORDS } from '../scripts/seed';

const userRepository = new UserRepository();
const patientRepository = new PatientRepository();
const doctorRepository = new DoctorRepository();
const hospitalRepository = new HospitalRepository();
const platformService = new PlatformService();

export interface RegisterPatientInput {
  hospitalId?: string;
  hospitalSlug?: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'female' | 'male' | 'other' | 'undisclosed';
  phone: string;
  address: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  emergencyContacts?: { name: string; relationship: string; phone: string }[];
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterHospitalInput {
  name: string;
  region: string;
  baseCurrency: BaseCurrency;
  address: Address;
  adminContact: { name: string; email: string; phone: string };
  admin: { firstName: string; lastName: string; email: string; password: string };
  ipAddress?: string;
  userAgent?: string;
}

function toAuthUser(
  user: {
    id: string;
    role: AuthUser['role'];
    email: string;
    firstName: string;
    lastName: string;
  },
  hospital?: { id: string; name: string; baseCurrency: BaseCurrency } | null,
): AuthUser {
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    hospitalId: hospital?.id,
    hospitalName: hospital?.name ?? (user.role === 'SUPER_ADMIN' ? 'PulseCare Platform' : undefined),
    baseCurrency: hospital?.baseCurrency ?? 'INR',
  };
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugifyHospitalName(name);
  let slug = base;
  let attempt = 1;
  while (await hospitalRepository.findBySlug(slug)) {
    slug = `${base}-${attempt}`;
    attempt += 1;
  }
  return slug;
}

export class AuthService {
  async registerHospital(input: RegisterHospitalInput) {
    if (!input.admin.password || input.admin.password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }
    if (input.baseCurrency !== 'INR' && input.baseCurrency !== 'USD') {
      throw new AppError('baseCurrency must be INR or USD', 400);
    }
    const existingUser = await userRepository.findByEmail(input.admin.email);
    if (existingUser) {
      throw new AppError('An account with this email already exists', 409);
    }

    const hospital = await hospitalRepository.create({
      name: input.name,
      slug: await uniqueSlug(input.name),
      region: input.region,
      baseCurrency: input.baseCurrency,
      address: input.address,
      adminContact: input.adminContact,
      isActive: true,
    });

    const user = await userRepository.create({
      hospitalId: hospital._id,
      email: input.admin.email.toLowerCase(),
      passwordHash: await hashPassword(input.admin.password),
      role: 'HOSPITAL_ADMIN',
      firstName: input.admin.firstName,
      lastName: input.admin.lastName,
      isActive: true,
    });

    const authUser = toAuthUser(
      {
        id: String(user._id),
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      { id: String(hospital._id), name: hospital.name, baseCurrency: hospital.baseCurrency },
    );

    await writeAuditLog({
      hospitalId: String(hospital._id),
      userId: String(user._id),
      role: 'HOSPITAL_ADMIN',
      actionType: 'HOSPITAL_REGISTER',
      resource: 'Hospital',
      resourceId: String(hospital._id),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await platformService.issueOnboardingInvoice(String(hospital._id), hospital.baseCurrency);

    return {
      token: signToken(authUser),
      user: authUser,
      profileId: null,
      hospital: {
        id: String(hospital._id),
        name: hospital.name,
        slug: hospital.slug,
        baseCurrency: hospital.baseCurrency,
        region: hospital.region,
      },
    };
  }

  async registerPatient(input: RegisterPatientInput) {
    const hospital = await this.resolveHospital(input.hospitalId, input.hospitalSlug);
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError('An account with this email already exists', 409);
    }
    if (!input.password || input.password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    const user = await userRepository.create({
      hospitalId: hospital._id,
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password),
      role: 'PATIENT',
      firstName: input.firstName,
      lastName: input.lastName,
      isActive: true,
    });

    const patient = await patientRepository.create({
      hospitalId: hospital._id,
      userId: user._id,
      mrn: generateMrn(),
      dateOfBirth: new Date(input.dateOfBirth),
      gender: input.gender,
      phone: input.phone,
      address: {
        ...input.address,
        country: input.address.country ?? 'US',
      },
      emergencyContacts: input.emergencyContacts ?? [],
    });

    const authUser = toAuthUser(
      {
        id: String(user._id),
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      { id: String(hospital._id), name: hospital.name, baseCurrency: hospital.baseCurrency },
    );

    await writeAuditLog({
      hospitalId: String(hospital._id),
      userId: String(user._id),
      role: 'PATIENT',
      actionType: 'AUTH_REGISTER',
      resource: 'User',
      resourceId: String(user._id),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      token: signToken(authUser),
      user: authUser,
      profileId: String(patient._id),
    };
  }

  async login(email: string, password: string, ipAddress?: string, userAgent?: string) {
    const user = await userRepository.findByEmail(email);
    if (!user || !user.isActive) {
      throw new AppError('Invalid email or password', 401);
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new AppError('Invalid email or password', 401);
    }

    const hospital = user.hospitalId
      ? await hospitalRepository.findById(String(user.hospitalId))
      : null;
    if (!isSuperAdmin(user.role) && (!hospital || !hospital.isActive)) {
      throw new AppError('This hospital workspace is inactive', 403);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const authUser = toAuthUser(
      {
        id: String(user._id),
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      hospital
        ? { id: String(hospital._id), name: hospital.name, baseCurrency: hospital.baseCurrency }
        : null,
    );

    let profileId: string | null = null;
    if (user.role === 'PATIENT') {
      const patient = await patientRepository.findByUserId(String(user._id));
      profileId = patient ? String(patient._id) : null;
    }
    if (user.role === 'DOCTOR') {
      const doctor = await doctorRepository.findByUserId(String(user._id));
      profileId = doctor ? String(doctor._id) : null;
    }

    await writeAuditLog({
      hospitalId: hospital ? String(hospital._id) : undefined,
      userId: String(user._id),
      role: user.role,
      actionType: 'AUTH_LOGIN',
      resource: 'User',
      resourceId: String(user._id),
      ipAddress,
      userAgent,
    });

    return { token: signToken(authUser), user: authUser, profileId };
  }

  async me(authUser: AuthUser) {
    const user = await userRepository.findById(authUser.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    const hospital = user.hospitalId
      ? await hospitalRepository.findById(String(user.hospitalId))
      : null;
    if (!isSuperAdmin(user.role) && !hospital) {
      throw new AppError('Hospital not found', 404);
    }

    let profile = null;
    if (user.role === 'PATIENT') {
      profile = await patientRepository.findByUserId(authUser.id);
    } else if (user.role === 'DOCTOR') {
      profile = await doctorRepository.findByUserId(authUser.id);
    }

    return {
      user: toAuthUser(
        {
          id: String(user._id),
          role: user.role,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        hospital
          ? { id: String(hospital._id), name: hospital.name, baseCurrency: hospital.baseCurrency }
          : null,
      ),
      profile,
      hospital: hospital
        ? {
            id: String(hospital._id),
            name: hospital.name,
            slug: hospital.slug,
            baseCurrency: hospital.baseCurrency,
            region: hospital.region,
          }
        : null,
    };
  }

  async directory() {
    return hospitalRepository.directory();
  }

  async demoAccounts() {
    const hospitals = await hospitalRepository.listAll();
    const hospitalById = new Map(hospitals.map((item) => [String(item._id), item]));
    const users = await userRepository.list({ isActive: true });
    const roleKey: Record<string, 'super' | 'hospital' | 'doctor' | 'patient'> = {
      SUPER_ADMIN: 'super',
      HOSPITAL_ADMIN: 'hospital',
      DOCTOR: 'doctor',
      PATIENT: 'patient',
    };
    const seen = new Set<string>();
    const accounts = [];
    for (const user of users) {
      const key = roleKey[user.role];
      if (!key) continue;
      if (key !== 'hospital' && seen.has(key)) continue;
      const password = SEED_ACCOUNT_PASSWORDS[user.email];
      if (!password) continue;
      if (key !== 'hospital') seen.add(key);
      const tenant = user.hospitalId ? hospitalById.get(String(user.hospitalId)) : undefined;
      const hospitalName = tenant?.name ?? 'Hospital';
      const adminLabel =
        tenant?.slug === 'apollo-hospital-chennai'
          ? 'Login as Apollo Hospital Admin'
          : `Login as ${hospitalName} Admin`;
      accounts.push({
        key,
        email: user.email,
        password,
        label:
          key === 'super'
            ? 'Login as Super Admin'
            : key === 'hospital'
              ? adminLabel
              : key === 'doctor'
                ? `Login as ${hospitalName} Doctor`
                : 'Login as Patient',
        description: `${user.firstName} ${user.lastName} · ${user.role}`,
      });
    }
    return { hospital: hospitals[0] ?? null, accounts };
  }

  private async resolveHospital(hospitalId?: string, hospitalSlug?: string): Promise<HospitalDocument> {
    if (hospitalId) {
      const hospital = await hospitalRepository.findById(hospitalId);
      if (!hospital || !hospital.isActive) {
        throw new AppError('Hospital not found', 404);
      }
      return hospital;
    }
    if (hospitalSlug) {
      const hospital = await hospitalRepository.findBySlug(hospitalSlug);
      if (!hospital) {
        throw new AppError('Hospital not found', 404);
      }
      return hospital;
    }
    throw new AppError('Select a hospital to continue registration', 400);
  }
}
