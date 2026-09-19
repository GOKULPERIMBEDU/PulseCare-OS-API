import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { HospitalModel } from '../models/hospital.model';
import { UserModel } from '../models/user.model';
import { PatientModel } from '../models/patient.model';
import { DoctorModel } from '../models/doctor.model';
import { AppointmentModel } from '../models/appointment.model';
import { PrescriptionModel } from '../models/prescription.model';
import { BillingModel } from '../models/billing.model';
import { SaaSBillingModel } from '../models/saasBilling.model';
import { AuditLogModel } from '../models/auditLog.model';
import { hashPassword } from '../utils/password';
import { addMinutes, generateInvoiceNumber, generateMrn, generateSaasInvoiceNumber, todayDateString } from '../utils/helpers';
import { isWhiteLabelEmail, whiteLabelEmail } from '../utils/email';
import { UserRole } from '../types';

const weekdayHours = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: '09:00',
  endTime: '17:00',
  slotMinutes: 30,
}));

export const SEED_ACCOUNT_PASSWORDS: Record<string, string> = {
  [whiteLabelEmail('superadmin')]: 'PulseCare!super',
  [whiteLabelEmail('admin')]: 'PulseCare!admin',
  [whiteLabelEmail('doctor')]: 'PulseCare!doctor',
  [whiteLabelEmail('patient')]: 'PulseCare!patient',
  [whiteLabelEmail('sarah.chen')]: 'PulseCare!admin',
  [whiteLabelEmail('marcus.lee')]: 'PulseCare!doctor',
  [whiteLabelEmail('amina.rahman')]: 'PulseCare!doctor',
  [whiteLabelEmail('priya.shah')]: 'PulseCare!patient',
  [whiteLabelEmail('jordan.wells')]: 'PulseCare!patient',
  [whiteLabelEmail('dr.sharma')]: 'PulseCare!doctor',
  [whiteLabelEmail('patient2')]: 'PulseCare!patient',
  [whiteLabelEmail('patient3')]: 'PulseCare!patient',
};

const LEGACY_EMAIL_MIGRATIONS: Array<[string, string]> = [
  ['admin@sf.pulsecare.os', whiteLabelEmail('sarah.chen')],
  ['doctor@sf.pulsecare.os', whiteLabelEmail('marcus.lee')],
  ['patient@sf.pulsecare.os', whiteLabelEmail('priya.shah')],
  ['dr.sharma@apollo.in', whiteLabelEmail('dr.sharma')],
  ['patient2@apollo.in', whiteLabelEmail('patient2')],
  ['patient3@apollo.in', whiteLabelEmail('patient3')],
];

const SEED_HOSPITAL_SLUG = 'pulsecare-general';
const APOLLO_HOSPITAL_SLUG = 'apollo-hospital-chennai';

function clinicDate(): string {
  const today = todayDateString();
  const weekday = new Date(`${today}T00:00:00`).getDay();
  return weekday === 0 || weekday === 6
    ? new Date(Date.now() + (weekday === 0 ? 1 : 2) * 86400000).toISOString().slice(0, 10)
    : today;
}

async function seed(): Promise<void> {
  await connectDatabase();
  await seedDatabase(true);
  await disconnectDatabase();
  await mongoose.connection.close();
}

export async function seedDatabase(reset = true): Promise<void> {
  if (reset) {
    await Promise.all([
      HospitalModel.deleteMany({}),
      UserModel.deleteMany({}),
      PatientModel.deleteMany({}),
      DoctorModel.deleteMany({}),
      AppointmentModel.deleteMany({}),
      PrescriptionModel.deleteMany({}),
      BillingModel.deleteMany({}),
      SaaSBillingModel.deleteMany({}),
      AuditLogModel.deleteMany({}),
    ]);
  }

  if (!(await HospitalModel.findOne({ slug: SEED_HOSPITAL_SLUG }))) {
    await seedPulseCareHospital();
  }
  if (!(await HospitalModel.findOne({ slug: APOLLO_HOSPITAL_SLUG }))) {
    await seedApolloHospital();
  }
  await alignPrimaryIndianLogins();
  await migrateLegacyEmailsToWhiteLabel();

  console.log('PulseCare OS seed complete.');
}

async function alignPrimaryIndianLogins(): Promise<void> {
  const indian = await HospitalModel.findOne({ slug: APOLLO_HOSPITAL_SLUG });
  const us = await HospitalModel.findOne({ slug: SEED_HOSPITAL_SLUG });
  if (!indian) return;

  const pairs = [
    {
      role: 'HOSPITAL_ADMIN' as const,
      canonical: whiteLabelEmail('admin'),
      usFallback: whiteLabelEmail('sarah.chen'),
    },
    {
      role: 'DOCTOR' as const,
      canonical: whiteLabelEmail('doctor'),
      usFallback: whiteLabelEmail('marcus.lee'),
    },
    {
      role: 'PATIENT' as const,
      canonical: whiteLabelEmail('patient'),
      usFallback: whiteLabelEmail('priya.shah'),
    },
  ];

  for (const pair of pairs) {
    const onIndian = await UserModel.findOne({ hospitalId: indian._id, role: pair.role }).sort({ createdAt: 1 });
    if (!onIndian) continue;
    const occupant = await UserModel.findOne({ email: pair.canonical });
    if (occupant && String(occupant._id) !== String(onIndian._id)) {
      if (us && occupant.hospitalId && String(occupant.hospitalId) === String(us._id)) {
        occupant.email = pair.usFallback;
        occupant.passwordHash = await hashPassword(SEED_ACCOUNT_PASSWORDS[pair.usFallback]);
        await occupant.save();
      }
    }
    if (onIndian.email !== pair.canonical) {
      onIndian.email = pair.canonical;
      onIndian.passwordHash = await hashPassword(SEED_ACCOUNT_PASSWORDS[pair.canonical]);
      await onIndian.save();
    }
  }
}

async function migrateLegacyEmailsToWhiteLabel(): Promise<void> {
  for (const [from, to] of LEGACY_EMAIL_MIGRATIONS) {
    const user = await UserModel.findOne({ email: from });
    if (!user) continue;
    const occupant = await UserModel.findOne({ email: to });
    if (occupant && String(occupant._id) !== String(user._id)) continue;
    user.email = to;
    const password = SEED_ACCOUNT_PASSWORDS[to];
    if (password) {
      user.passwordHash = await hashPassword(password);
    }
    await user.save();
  }

  const leftovers = await UserModel.find({});
  for (const user of leftovers) {
    if (isWhiteLabelEmail(user.email)) continue;
    const local = user.email.split('@')[0] || 'user';
    let candidate = whiteLabelEmail(local);
    let suffix = 2;
    while (await UserModel.findOne({ email: candidate, _id: { $ne: user._id } })) {
      candidate = whiteLabelEmail(`${local}${suffix}`);
      suffix += 1;
    }
    user.email = candidate;
    const password = SEED_ACCOUNT_PASSWORDS[candidate];
    if (password) {
      user.passwordHash = await hashPassword(password);
    }
    await user.save();
  }

  const us = await HospitalModel.findOne({ slug: SEED_HOSPITAL_SLUG });
  if (us && us.adminContact?.email && !isWhiteLabelEmail(us.adminContact.email)) {
    us.adminContact.email = whiteLabelEmail('sarah.chen');
    await us.save();
  }
}

async function seedPulseCareHospital(): Promise<void> {

  const hospital = await HospitalModel.create({
    name: 'PulseCare General Hospital',
    slug: SEED_HOSPITAL_SLUG,
    region: 'San Francisco Bay Area',
    baseCurrency: 'USD',
    address: {
      line1: '100 Health Plaza',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94107',
      country: 'US',
    },
    adminContact: {
      name: 'Sarah Chen',
      email: whiteLabelEmail('sarah.chen'),
      phone: '+1-415-555-0100',
    },
    isActive: true,
  });

  await UserModel.create({
    email: whiteLabelEmail('superadmin'),
    passwordHash: await hashPassword(SEED_ACCOUNT_PASSWORDS[whiteLabelEmail('superadmin')]),
    role: 'SUPER_ADMIN',
    firstName: 'Jordan',
    lastName: 'Ellis',
    isActive: true,
  });

  const admin = await UserModel.create({
    hospitalId: hospital._id,
    email: whiteLabelEmail('sarah.chen'),
    passwordHash: await hashPassword(SEED_ACCOUNT_PASSWORDS[whiteLabelEmail('sarah.chen')]),
    role: 'HOSPITAL_ADMIN',
    firstName: 'Sarah',
    lastName: 'Chen',
    isActive: true,
  });

  const doctorUser = await UserModel.create({
    hospitalId: hospital._id,
    email: whiteLabelEmail('marcus.lee'),
    passwordHash: await hashPassword(SEED_ACCOUNT_PASSWORDS[whiteLabelEmail('marcus.lee')]),
    role: 'DOCTOR',
    firstName: 'Marcus',
    lastName: 'Lee',
    isActive: true,
  });

  const doctorUser2 = await UserModel.create({
    hospitalId: hospital._id,
    email: whiteLabelEmail('amina.rahman'),
    passwordHash: await hashPassword(SEED_ACCOUNT_PASSWORDS[whiteLabelEmail('amina.rahman')]),
    role: 'DOCTOR',
    firstName: 'Amina',
    lastName: 'Rahman',
    isActive: true,
  });

  const patientUser = await UserModel.create({
    hospitalId: hospital._id,
    email: whiteLabelEmail('priya.shah'),
    passwordHash: await hashPassword(SEED_ACCOUNT_PASSWORDS[whiteLabelEmail('priya.shah')]),
    role: 'PATIENT',
    firstName: 'Priya',
    lastName: 'Shah',
    isActive: true,
  });

  const patientUser2 = await UserModel.create({
    hospitalId: hospital._id,
    email: whiteLabelEmail('jordan.wells'),
    passwordHash: await hashPassword(SEED_ACCOUNT_PASSWORDS[whiteLabelEmail('jordan.wells')]),
    role: 'PATIENT',
    firstName: 'Jordan',
    lastName: 'Wells',
    isActive: true,
  });

  const doctor = await DoctorModel.create({
    hospitalId: hospital._id,
    userId: doctorUser._id,
    specialization: 'Cardiology',
    department: 'Heart Institute',
    consultationFee: 150,
    licenseNumber: 'CA-MD-44122',
    bio: 'Consultant cardiologist focusing on hypertension and preventive heart care.',
    availability: weekdayHours,
  });

  const doctor2 = await DoctorModel.create({
    hospitalId: hospital._id,
    userId: doctorUser2._id,
    specialization: 'Orthopedics',
    department: 'Bone & Joint',
    consultationFee: 185,
    licenseNumber: 'CA-MD-22819',
    bio: 'Orthopaedic surgeon for sports injuries and joint pain.',
    availability: weekdayHours,
  });

  const patient = await PatientModel.create({
    hospitalId: hospital._id,
    userId: patientUser._id,
    mrn: generateMrn(),
    dateOfBirth: new Date('1992-04-18'),
    gender: 'female',
    bloodGroup: 'O+',
    phone: '+1-415-555-0142',
    address: {
      line1: '88 Mission Street',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'US',
    },
    emergencyContacts: [{ name: 'Rahul Shah', relationship: 'Spouse', phone: '+1-415-555-0143' }],
    medicalHistory: [
      { title: 'Hypertension', note: 'Controlled with lifestyle and follow-up', recordedAt: new Date('2024-11-02') },
    ],
    allergies: ['Penicillin'],
    chronicConditions: ['Hypertension'],
  });

  const patient2 = await PatientModel.create({
    hospitalId: hospital._id,
    userId: patientUser2._id,
    mrn: generateMrn(),
    dateOfBirth: new Date('1986-09-03'),
    gender: 'male',
    bloodGroup: 'A+',
    phone: '+1-415-555-0190',
    address: {
      line1: '12 Harbor Road',
      city: 'Oakland',
      state: 'CA',
      postalCode: '94607',
      country: 'US',
    },
    emergencyContacts: [{ name: 'Alex Wells', relationship: 'Sibling', phone: '+1-415-555-0191' }],
    medicalHistory: [{ title: 'ACL reconstruction', note: '2019, right knee', recordedAt: new Date('2019-06-12') }],
    allergies: [],
    chronicConditions: [],
  });

  const demoDate = clinicDate();

  const appt1 = await AppointmentModel.create({
    hospitalId: hospital._id,
    patientId: patient._id,
    doctorId: doctor._id,
    date: demoDate,
    timeSlot: '09:00',
    endTime: addMinutes('09:00', 30),
    reason: 'Follow-up blood pressure review',
    status: 'Waiting',
    checkedInAt: new Date(),
    createdBy: admin._id,
  });

  await AppointmentModel.create({
    hospitalId: hospital._id,
    patientId: patient2._id,
    doctorId: doctor._id,
    date: demoDate,
    timeSlot: '09:30',
    endTime: addMinutes('09:30', 30),
    reason: 'Chest tightness evaluation',
    status: 'Scheduled',
    createdBy: admin._id,
  });

  await AppointmentModel.create({
    hospitalId: hospital._id,
    patientId: patient2._id,
    doctorId: doctor2._id,
    date: demoDate,
    timeSlot: '10:00',
    endTime: addMinutes('10:00', 30),
    reason: 'Knee pain after training',
    status: 'Waiting',
    checkedInAt: new Date(),
    createdBy: admin._id,
  });

  await PrescriptionModel.create({
    hospitalId: hospital._id,
    patientId: patient._id,
    doctorId: doctor._id,
    appointmentId: appt1._id,
    medications: [
      {
        name: 'Lisinopril',
        dosage: '10mg',
        frequency: 'Once daily',
        duration: '30 days',
        instructions: 'Take in the morning after breakfast',
      },
    ],
    notes: 'Recheck BP in two weeks. Reduce sodium intake.',
    issuedAt: new Date(),
  });

  await BillingModel.create({
    hospitalId: hospital._id,
    invoiceNumber: generateInvoiceNumber(),
    patientId: patient._id,
    appointmentId: appt1._id,
    doctorId: doctor._id,
    items: [{ description: 'ECG', quantity: 1, unitPrice: 85, amount: 85 }],
    consultationFee: 150,
    treatmentFees: 85,
    subtotal: 235,
    taxRate: 0.08,
    taxAmount: 18.8,
    totalAmount: 253.8,
    paymentStatus: 'Pending',
  });

  await BillingModel.create({
    hospitalId: hospital._id,
    invoiceNumber: generateInvoiceNumber(),
    patientId: patient2._id,
    doctorId: doctor2._id,
    items: [{ description: 'Orthopedic consult', quantity: 1, unitPrice: 185, amount: 185 }],
    consultationFee: 185,
    treatmentFees: 0,
    subtotal: 185,
    taxRate: 0.08,
    taxAmount: 14.8,
    totalAmount: 199.8,
    paymentStatus: 'Paid',
    paidAt: new Date(),
  });

  await SaaSBillingModel.create({
    hospitalId: hospital._id,
    invoiceNumber: generateSaasInvoiceNumber(),
    plan: 'professional',
    billingPeriod: 'monthly',
    amount: 499,
    currency: 'USD',
    status: 'Paid',
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    paidAt: new Date(),
    notes: 'PulseCare General Hospital professional plan',
  });

  await AuditLogModel.create({
    hospitalId: hospital._id,
    userId: admin._id,
    role: 'HOSPITAL_ADMIN' as UserRole,
    actionType: 'SYSTEM_SEED',
    resource: 'Database',
    metadata: { environment: 'development' },
    ipAddress: '127.0.0.1',
  });

  console.log('Hospital PulseCare General Hospital (USD)');
  console.log(`Super Admin     ${whiteLabelEmail('superadmin')} / PulseCare!super`);
  console.log(`Hospital Admin  ${whiteLabelEmail('sarah.chen')} / PulseCare!admin`);
  console.log(`Doctor          ${whiteLabelEmail('marcus.lee')} / PulseCare!doctor`);
  console.log(`Patient         ${whiteLabelEmail('priya.shah')} / PulseCare!patient`);
}

async function seedApolloHospital(): Promise<void> {
  const hospital = await HospitalModel.create({
    name: 'Apollo Hospital Chennai',
    slug: APOLLO_HOSPITAL_SLUG,
    region: 'Chennai, Tamil Nadu, India',
    baseCurrency: 'INR',
    address: {
      line1: '21 Greams Lane, Off Greams Road',
      city: 'Chennai',
      state: 'Tamil Nadu',
      postalCode: '600006',
      country: 'IN',
    },
    adminContact: {
      name: 'Lakshmi Venkatesh',
      email: whiteLabelEmail('admin'),
      phone: '+91-44-2829-3333',
    },
    isActive: true,
  });

  const admin = await UserModel.create({
    hospitalId: hospital._id,
    email: whiteLabelEmail('admin'),
    passwordHash: await hashPassword(SEED_ACCOUNT_PASSWORDS[whiteLabelEmail('admin')]),
    role: 'HOSPITAL_ADMIN',
    firstName: 'Lakshmi',
    lastName: 'Venkatesh',
    isActive: true,
  });

  const doctorUser = await UserModel.create({
    hospitalId: hospital._id,
    email: whiteLabelEmail('doctor'),
    passwordHash: await hashPassword(SEED_ACCOUNT_PASSWORDS[whiteLabelEmail('doctor')]),
    role: 'DOCTOR',
    firstName: 'Ramesh',
    lastName: 'Krishnan',
    isActive: true,
  });

  const doctorUser2 = await UserModel.create({
    hospitalId: hospital._id,
    email: whiteLabelEmail('dr.sharma'),
    passwordHash: await hashPassword(SEED_ACCOUNT_PASSWORDS[whiteLabelEmail('dr.sharma')]),
    role: 'DOCTOR',
    firstName: 'Anil',
    lastName: 'Sharma',
    isActive: true,
  });

  const patientUser1 = await UserModel.create({
    hospitalId: hospital._id,
    email: whiteLabelEmail('patient'),
    passwordHash: await hashPassword(SEED_ACCOUNT_PASSWORDS[whiteLabelEmail('patient')]),
    role: 'PATIENT',
    firstName: 'Arjun',
    lastName: 'Nair',
    isActive: true,
  });

  const patientUser2 = await UserModel.create({
    hospitalId: hospital._id,
    email: whiteLabelEmail('patient2'),
    passwordHash: await hashPassword(SEED_ACCOUNT_PASSWORDS[whiteLabelEmail('patient2')]),
    role: 'PATIENT',
    firstName: 'Meera',
    lastName: 'Iyer',
    isActive: true,
  });

  const patientUser3 = await UserModel.create({
    hospitalId: hospital._id,
    email: whiteLabelEmail('patient3'),
    passwordHash: await hashPassword(SEED_ACCOUNT_PASSWORDS[whiteLabelEmail('patient3')]),
    role: 'PATIENT',
    firstName: 'Karthik',
    lastName: 'Subramanian',
    isActive: true,
  });

  const doctor = await DoctorModel.create({
    hospitalId: hospital._id,
    userId: doctorUser._id,
    specialization: 'Cardiology',
    department: 'Heart Institute',
    consultationFee: 1500,
    licenseNumber: 'TNMC-441-CHN',
    bio: 'Consultant cardiologist focusing on hypertension and preventive heart care.',
    availability: weekdayHours,
  });

  const doctor2 = await DoctorModel.create({
    hospitalId: hospital._id,
    userId: doctorUser2._id,
    specialization: 'Orthopedics',
    department: 'Bone & Joint',
    consultationFee: 1000,
    licenseNumber: 'TNMC-228-MDS',
    bio: 'Orthopaedic surgeon for sports injuries and joint pain.',
    availability: weekdayHours,
  });

  const patient1 = await PatientModel.create({
    hospitalId: hospital._id,
    userId: patientUser1._id,
    mrn: generateMrn(),
    dateOfBirth: new Date('1992-04-18'),
    gender: 'male',
    bloodGroup: 'O+',
    phone: '+91-98765-43210',
    address: {
      line1: '14 Luz Church Road',
      city: 'Chennai',
      state: 'Tamil Nadu',
      postalCode: '600004',
      country: 'IN',
    },
    emergencyContacts: [{ name: 'Divya Nair', relationship: 'Spouse', phone: '+91-98765-43211' }],
    medicalHistory: [
      { title: 'Hypertension', note: 'Controlled with lifestyle and follow-up', recordedAt: new Date('2024-11-02') },
    ],
    allergies: ['Penicillin'],
    chronicConditions: ['Hypertension'],
  });

  const patient2 = await PatientModel.create({
    hospitalId: hospital._id,
    userId: patientUser2._id,
    mrn: generateMrn(),
    dateOfBirth: new Date('1988-07-21'),
    gender: 'female',
    bloodGroup: 'B+',
    phone: '+91-98400-22118',
    address: {
      line1: '7 Besant Avenue, Adyar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      postalCode: '600020',
      country: 'IN',
    },
    emergencyContacts: [{ name: 'Suresh Iyer', relationship: 'Spouse', phone: '+91-98400-22119' }],
    medicalHistory: [],
    allergies: [],
    chronicConditions: [],
  });

  const patient3 = await PatientModel.create({
    hospitalId: hospital._id,
    userId: patientUser3._id,
    mrn: generateMrn(),
    dateOfBirth: new Date('1986-09-03'),
    gender: 'male',
    bloodGroup: 'A+',
    phone: '+91-98840-11022',
    address: {
      line1: '42 Anna Nagar West',
      city: 'Chennai',
      state: 'Tamil Nadu',
      postalCode: '600040',
      country: 'IN',
    },
    emergencyContacts: [{ name: 'Ananya Subramanian', relationship: 'Sister', phone: '+91-98840-11023' }],
    medicalHistory: [{ title: 'ACL reconstruction', note: '2019, right knee', recordedAt: new Date('2019-06-12') }],
    allergies: [],
    chronicConditions: [],
  });

  const demoDate = clinicDate();

  const appt1 = await AppointmentModel.create({
    hospitalId: hospital._id,
    patientId: patient1._id,
    doctorId: doctor._id,
    date: demoDate,
    timeSlot: '09:00',
    endTime: addMinutes('09:00', 30),
    reason: 'Follow-up blood pressure review',
    status: 'Waiting',
    checkedInAt: new Date(),
    createdBy: admin._id,
  });

  await AppointmentModel.create({
    hospitalId: hospital._id,
    patientId: patient2._id,
    doctorId: doctor._id,
    date: demoDate,
    timeSlot: '09:30',
    endTime: addMinutes('09:30', 30),
    reason: 'Chest tightness evaluation',
    status: 'Scheduled',
    createdBy: admin._id,
  });

  const appt3 = await AppointmentModel.create({
    hospitalId: hospital._id,
    patientId: patient3._id,
    doctorId: doctor2._id,
    date: demoDate,
    timeSlot: '10:00',
    endTime: addMinutes('10:00', 30),
    reason: 'Knee pain after training',
    status: 'Waiting',
    checkedInAt: new Date(),
    createdBy: admin._id,
  });

  await PrescriptionModel.create({
    hospitalId: hospital._id,
    patientId: patient1._id,
    doctorId: doctor._id,
    appointmentId: appt1._id,
    medications: [
      {
        name: 'Telmisartan',
        dosage: '40mg',
        frequency: 'Once daily',
        duration: '30 days',
        instructions: 'Take in the morning after breakfast',
      },
    ],
    notes: 'Recheck BP in two weeks. Reduce sodium intake.',
    issuedAt: new Date(),
  });

  await BillingModel.create({
    hospitalId: hospital._id,
    invoiceNumber: generateInvoiceNumber(),
    patientId: patient1._id,
    appointmentId: appt1._id,
    doctorId: doctor._id,
    items: [{ description: 'ECG', quantity: 1, unitPrice: 1000, amount: 1000 }],
    consultationFee: 1500,
    treatmentFees: 1000,
    subtotal: 2500,
    taxRate: 0.18,
    taxAmount: 450,
    totalAmount: 2950,
    paymentStatus: 'Pending',
  });

  await BillingModel.create({
    hospitalId: hospital._id,
    invoiceNumber: generateInvoiceNumber(),
    patientId: patient3._id,
    appointmentId: appt3._id,
    doctorId: doctor2._id,
    items: [{ description: 'Orthopedic consult', quantity: 1, unitPrice: 1000, amount: 1000 }],
    consultationFee: 1000,
    treatmentFees: 0,
    subtotal: 1000,
    taxRate: 0.18,
    taxAmount: 180,
    totalAmount: 1180,
    paymentStatus: 'Paid',
    paidAt: new Date(),
  });

  await BillingModel.create({
    hospitalId: hospital._id,
    invoiceNumber: generateInvoiceNumber(),
    patientId: patient2._id,
    doctorId: doctor._id,
    items: [{ description: 'Treadmill test', quantity: 1, unitPrice: 2500, amount: 2500 }],
    consultationFee: 1500,
    treatmentFees: 2500,
    subtotal: 4000,
    taxRate: 0.18,
    taxAmount: 720,
    totalAmount: 4720,
    paymentStatus: 'Pending',
  });

  await SaaSBillingModel.create({
    hospitalId: hospital._id,
    invoiceNumber: generateSaasInvoiceNumber(),
    plan: 'professional',
    billingPeriod: 'monthly',
    amount: 39999,
    currency: 'INR',
    status: 'Paid',
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    paidAt: new Date(),
    notes: 'Apollo Hospital Chennai professional plan',
  });

  await AuditLogModel.create({
    hospitalId: hospital._id,
    userId: admin._id,
    role: 'HOSPITAL_ADMIN' as UserRole,
    actionType: 'SYSTEM_SEED',
    resource: 'Database',
    metadata: { environment: 'development', tenant: APOLLO_HOSPITAL_SLUG },
    ipAddress: '127.0.0.1',
  });

  console.log('Hospital Apollo Hospital Chennai (INR)');
  console.log(`Hospital Admin  ${whiteLabelEmail('admin')} / PulseCare!admin`);
  console.log(`Doctor          ${whiteLabelEmail('doctor')} / PulseCare!doctor`);
  console.log(`Patient         ${whiteLabelEmail('patient')} / PulseCare!patient`);
}

if (require.main === module) {
  seed().catch(async (error) => {
    console.error(error);
    await disconnectDatabase();
    process.exit(1);
  });
}
