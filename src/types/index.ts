export type UserRole = 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR' | 'PATIENT';

export const USER_ROLES: UserRole[] = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'PATIENT'];

export type SaasPlan = 'starter' | 'professional' | 'enterprise';
export type SaasBillingPeriod = 'monthly' | 'annual';
export type SaasPaymentStatus = 'Paid' | 'Pending' | 'Overdue';

export function isSuperAdmin(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

export function roleHomePath(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/super-admin';
    case 'HOSPITAL_ADMIN':
      return '/hospital-admin';
    case 'DOCTOR':
      return '/doctor';
    case 'PATIENT':
      return '/patient';
  }
}

export type AppointmentStatus =
  | 'Scheduled'
  | 'Waiting'
  | 'In-Consultation'
  | 'Completed'
  | 'Cancelled';

export type PaymentStatus = 'Paid' | 'Pending';

export type DocumentCategory = 'report' | 'lab' | 'prescription' | 'other';

export type Gender = 'female' | 'male' | 'other' | 'undisclosed';

export type BaseCurrency = 'INR' | 'USD';

export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
  firstName: string;
  lastName: string;
  hospitalId?: string;
  hospitalName?: string;
  baseCurrency: BaseCurrency;
}

export interface ApiErrorBody {
  message: string;
  statusCode: number;
  details?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  database: 'connected' | 'disconnected';
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface MedicalHistoryReference {
  title: string;
  note?: string;
  recordedAt?: Date;
  documentId?: string;
}

export interface Address {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface AvailabilityWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

export interface MedicationItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'Scheduled',
  'Waiting',
  'In-Consultation',
];

export const QUEUE_STATUSES: AppointmentStatus[] = [
  'Waiting',
  'In-Consultation',
  'Completed',
];
