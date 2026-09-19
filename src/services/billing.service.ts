import { AppError, AuthUser, InvoiceItem, PaymentStatus } from '../types';
import { BillingRepository } from '../repositories/billing.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { generateInvoiceNumber } from '../utils/helpers';
import { writeAuditLog } from '../utils/audit';
import { assertHospitalScope, tenantFilter } from '../utils/tenant';

const billingRepository = new BillingRepository();
const appointmentRepository = new AppointmentRepository();
const doctorRepository = new DoctorRepository();
const patientRepository = new PatientRepository();

function totals(input: {
  items: InvoiceItem[];
  consultationFee: number;
  treatmentFees: number;
  taxRate: number;
}) {
  const itemTotal = input.items.reduce((sum, item) => sum + item.amount, 0);
  const subtotal = itemTotal + input.consultationFee + input.treatmentFees;
  const taxAmount = Number((subtotal * input.taxRate).toFixed(2));
  return {
    subtotal: Number(subtotal.toFixed(2)),
    taxAmount,
    totalAmount: Number((subtotal + taxAmount).toFixed(2)),
  };
}

export class BillingService {
  async list(authUser: AuthUser) {
    if (authUser.role === 'PATIENT') {
      const patient = await patientRepository.findByUserId(authUser.id);
      if (!patient) return [];
      return billingRepository.list({ hospitalId: authUser.hospitalId, patientId: patient._id });
    }
    return billingRepository.list(tenantFilter(authUser));
  }

  async getById(id: string, authUser: AuthUser) {
    const invoice = await billingRepository.findById(id);
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    assertHospitalScope(invoice, authUser);
    if (authUser.role === 'PATIENT') {
      const patient = await patientRepository.findByUserId(authUser.id);
      const patientId =
        typeof invoice.patientId === 'object' && invoice.patientId && '_id' in (invoice.patientId as object)
          ? String((invoice.patientId as { _id: unknown })._id)
          : String(invoice.patientId);
      if (!patient || String(patient._id) !== patientId) {
        throw new AppError('You can only access your own invoices', 403);
      }
    }
    return invoice;
  }

  async create(
    input: {
      patientId?: string;
      appointmentId?: string;
      items?: InvoiceItem[];
      consultationFee?: number;
      treatmentFees?: number;
      taxRate?: number;
      notes?: string;
    },
    authUser: AuthUser,
    ipAddress?: string,
  ) {
    if (authUser.role === 'PATIENT') {
      throw new AppError('Patients cannot create invoices', 403);
    }

    let patientId = input.patientId;
    let doctorId: string | undefined;
    let consultationFee = input.consultationFee ?? 0;

    if (input.appointmentId) {
      const appointment = await appointmentRepository.findById(input.appointmentId);
      if (!appointment) {
        throw new AppError('Appointment not found', 404);
      }
      assertHospitalScope(appointment, authUser);
      patientId =
        typeof appointment.patientId === 'object' && appointment.patientId && '_id' in (appointment.patientId as object)
          ? String((appointment.patientId as { _id: unknown })._id)
          : String(appointment.patientId);
      doctorId =
        typeof appointment.doctorId === 'object' && appointment.doctorId && '_id' in (appointment.doctorId as object)
          ? String((appointment.doctorId as { _id: unknown })._id)
          : String(appointment.doctorId);
      const doctor = await doctorRepository.findById(doctorId);
      if (doctor && input.consultationFee === undefined) {
        consultationFee = doctor.consultationFee;
      }
    }

    if (!patientId) {
      throw new AppError('patientId is required', 400);
    }

    const items = (input.items ?? []).map((item) => ({
      ...item,
      amount: Number((item.quantity * item.unitPrice).toFixed(2)),
    }));
    const treatmentFees = input.treatmentFees ?? 0;
    const taxRate = input.taxRate ?? 0.08;
    const computed = totals({ items, consultationFee, treatmentFees, taxRate });

    const invoice = await billingRepository.create({
      hospitalId: authUser.hospitalId as never,
      invoiceNumber: generateInvoiceNumber(),
      patientId: patientId as never,
      appointmentId: input.appointmentId as never,
      doctorId: doctorId as never,
      items,
      consultationFee,
      treatmentFees,
      taxRate,
      ...computed,
      paymentStatus: 'Pending',
      notes: input.notes,
    });

    await writeAuditLog({
      hospitalId: authUser.hospitalId,
      userId: authUser.id,
      role: authUser.role,
      actionType: 'BILLING_CREATE',
      resource: 'Billing',
      resourceId: String(invoice._id),
      ipAddress,
    });

    return billingRepository.findById(String(invoice._id));
  }

  async updatePayment(id: string, paymentStatus: PaymentStatus, authUser: AuthUser, ipAddress?: string) {
    if (authUser.role !== 'HOSPITAL_ADMIN') {
      throw new AppError('Only administrators can update payment status', 403);
    }
    const invoice = await billingRepository.findById(id);
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    assertHospitalScope(invoice, authUser);
    const updated = await billingRepository.updateById(id, {
      paymentStatus,
      paidAt: paymentStatus === 'Paid' ? new Date() : undefined,
    });
    await writeAuditLog({
      hospitalId: authUser.hospitalId,
      userId: authUser.id,
      role: authUser.role,
      actionType: 'BILLING_PAYMENT',
      resource: 'Billing',
      resourceId: id,
      metadata: { paymentStatus },
      ipAddress,
    });
    return updated;
  }
}
