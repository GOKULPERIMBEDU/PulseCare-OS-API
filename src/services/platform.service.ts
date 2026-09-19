import { AppError, AuthUser, isSuperAdmin, SaasBillingPeriod, SaasPlan } from '../types';
import { HospitalRepository } from '../repositories/hospital.repository';
import { SaaSBillingRepository } from '../repositories/saasBilling.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { HealthRepository } from '../repositories/health.repository';
import { generateSaasInvoiceNumber } from '../utils/helpers';
import { writeAuditLog } from '../utils/audit';
import { HealthService } from './health.service';

const hospitalRepository = new HospitalRepository();
const saasBillingRepository = new SaaSBillingRepository();
const patientRepository = new PatientRepository();
const doctorRepository = new DoctorRepository();
const healthService = new HealthService(new HealthRepository());

const PLAN_PRICING: Record<SaasPlan, Record<'INR' | 'USD', number>> = {
  starter: { USD: 199, INR: 14999 },
  professional: { USD: 499, INR: 39999 },
  enterprise: { USD: 999, INR: 79999 },
};

function periodEnd(start: Date, billingPeriod: SaasBillingPeriod): Date {
  const end = new Date(start);
  if (billingPeriod === 'annual') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

export function defaultSaasAmount(
  plan: SaasPlan,
  currency: 'INR' | 'USD',
  billingPeriod: SaasBillingPeriod,
): number {
  const monthly = PLAN_PRICING[plan][currency];
  return billingPeriod === 'annual' ? Number((monthly * 10).toFixed(2)) : monthly;
}

export class PlatformService {
  async overview(authUser: AuthUser) {
    this.assertSuperAdmin(authUser);
    const [hospitals, activeHospitals, doctors, patients, paid, pending, health] = await Promise.all([
      hospitalRepository.count(),
      hospitalRepository.count({ isActive: true }),
      doctorRepository.count(),
      patientRepository.count(),
      saasBillingRepository.revenueSummary(),
      saasBillingRepository.pendingSummary(),
      Promise.resolve(healthService.getStatus()),
    ]);

    return {
      hospitals,
      activeHospitals,
      doctors,
      patients,
      saasRevenue: paid,
      saasOutstanding: pending,
      health,
    };
  }

  async listHospitals(authUser: AuthUser) {
    this.assertSuperAdmin(authUser);
    const hospitals = await hospitalRepository.listAll();
    const invoices = await saasBillingRepository.list();
    const latest = new Map<string, (typeof invoices)[number]>();
    for (const invoice of invoices) {
      const hospitalId = String(
        typeof invoice.hospitalId === 'object' && invoice.hospitalId && '_id' in invoice.hospitalId
          ? (invoice.hospitalId as { _id: unknown })._id
          : invoice.hospitalId,
      );
      if (!latest.has(hospitalId)) {
        latest.set(hospitalId, invoice);
      }
    }

    return hospitals.map((hospital) => {
      const subscription = latest.get(String(hospital._id));
      return {
        id: String(hospital._id),
        name: hospital.name,
        slug: hospital.slug,
        region: hospital.region,
        baseCurrency: hospital.baseCurrency,
        isActive: hospital.isActive,
        createdAt: hospital.createdAt,
        subscription: subscription
          ? {
              id: String(subscription._id),
              invoiceNumber: subscription.invoiceNumber,
              plan: subscription.plan,
              amount: subscription.amount,
              currency: subscription.currency,
              status: subscription.status,
              billingPeriod: subscription.billingPeriod,
              periodEnd: subscription.periodEnd,
            }
          : null,
      };
    });
  }

  async listSubscriptions(authUser: AuthUser) {
    this.assertSuperAdmin(authUser);
    return saasBillingRepository.list();
  }

  async createSubscription(
    authUser: AuthUser,
    input: {
      hospitalId: string;
      plan?: SaasPlan;
      billingPeriod?: SaasBillingPeriod;
      amount?: number;
      notes?: string;
    },
    ipAddress?: string,
  ) {
    this.assertSuperAdmin(authUser);
    const hospital = await hospitalRepository.findById(input.hospitalId);
    if (!hospital) {
      throw new AppError('Hospital not found', 404);
    }
    const plan = input.plan ?? 'professional';
    const billingPeriod = input.billingPeriod ?? 'monthly';
    const amount = input.amount ?? defaultSaasAmount(plan, hospital.baseCurrency, billingPeriod);
    const start = new Date();
    const invoice = await saasBillingRepository.create({
      hospitalId: hospital._id,
      invoiceNumber: generateSaasInvoiceNumber(),
      plan,
      billingPeriod,
      amount,
      currency: hospital.baseCurrency,
      status: 'Pending',
      periodStart: start,
      periodEnd: periodEnd(start, billingPeriod),
      notes: input.notes,
    });

    await writeAuditLog({
      hospitalId: String(hospital._id),
      userId: authUser.id,
      role: authUser.role,
      actionType: 'SAAS_BILLING_CREATE',
      resource: 'SaaSBilling',
      resourceId: String(invoice._id),
      ipAddress,
    });

    return saasBillingRepository.findById(String(invoice._id));
  }

  async updatePayment(
    authUser: AuthUser,
    id: string,
    status: 'Paid' | 'Pending' | 'Overdue',
    ipAddress?: string,
  ) {
    this.assertSuperAdmin(authUser);
    const invoice = await saasBillingRepository.findById(id);
    if (!invoice) {
      throw new AppError('SaaS invoice not found', 404);
    }
    const updated = await saasBillingRepository.updateById(id, {
      status,
      paidAt: status === 'Paid' ? new Date() : undefined,
    });
    await writeAuditLog({
      hospitalId: String(
        typeof invoice.hospitalId === 'object' && invoice.hospitalId && '_id' in invoice.hospitalId
          ? (invoice.hospitalId as { _id: unknown })._id
          : invoice.hospitalId,
      ),
      userId: authUser.id,
      role: authUser.role,
      actionType: 'SAAS_BILLING_PAYMENT',
      resource: 'SaaSBilling',
      resourceId: id,
      metadata: { status },
      ipAddress,
    });
    return updated;
  }

  async issueOnboardingInvoice(hospitalId: string, currency: 'INR' | 'USD') {
    const start = new Date();
    return saasBillingRepository.create({
      hospitalId: hospitalId as never,
      invoiceNumber: generateSaasInvoiceNumber(),
      plan: 'professional',
      billingPeriod: 'monthly',
      amount: defaultSaasAmount('professional', currency, 'monthly'),
      currency,
      status: 'Pending',
      periodStart: start,
      periodEnd: periodEnd(start, 'monthly'),
      notes: 'Initial workspace subscription',
    });
  }

  private assertSuperAdmin(authUser: AuthUser): void {
    if (!isSuperAdmin(authUser.role)) {
      throw new AppError('Platform operations are restricted to Super Admin', 403);
    }
  }
}
