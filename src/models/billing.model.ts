import mongoose, { Document, Schema, Types } from 'mongoose';
import { InvoiceItem, PaymentStatus } from '../types';

export interface BillingDocument extends Document {
  hospitalId: Types.ObjectId;
  invoiceNumber: string;
  patientId: Types.ObjectId;
  appointmentId?: Types.ObjectId;
  doctorId?: Types.ObjectId;
  items: InvoiceItem[];
  consultationFee: number;
  treatmentFees: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paidAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceItemSchema = new Schema<InvoiceItem>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const billingSchema = new Schema<BillingDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    invoiceNumber: { type: String, required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor' },
    items: { type: [invoiceItemSchema], default: [] },
    consultationFee: { type: Number, required: true, min: 0, default: 0 },
    treatmentFees: { type: Number, required: true, min: 0, default: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, required: true, min: 0, default: 0.08 },
    taxAmount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
    paidAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true },
);

billingSchema.index({ hospitalId: 1, invoiceNumber: 1 }, { unique: true });
billingSchema.index({ hospitalId: 1, patientId: 1, createdAt: -1 });
billingSchema.index({ hospitalId: 1, paymentStatus: 1, createdAt: -1 });

export const BillingModel =
  mongoose.models.Billing || mongoose.model<BillingDocument>('Billing', billingSchema);
