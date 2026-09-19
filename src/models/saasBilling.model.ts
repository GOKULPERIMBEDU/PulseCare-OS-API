import mongoose, { Document, Schema, Types } from 'mongoose';
import { BaseCurrency, SaasBillingPeriod, SaasPaymentStatus, SaasPlan } from '../types';

export interface SaaSBillingDocument extends Document {
  hospitalId: Types.ObjectId;
  invoiceNumber: string;
  plan: SaasPlan;
  billingPeriod: SaasBillingPeriod;
  amount: number;
  currency: BaseCurrency;
  status: SaasPaymentStatus;
  periodStart: Date;
  periodEnd: Date;
  paidAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const saasBillingSchema = new Schema<SaaSBillingDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true },
    plan: { type: String, enum: ['starter', 'professional', 'enterprise'], required: true },
    billingPeriod: { type: String, enum: ['monthly', 'annual'], required: true, default: 'monthly' },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['INR', 'USD'], required: true },
    status: { type: String, enum: ['Paid', 'Pending', 'Overdue'], default: 'Pending' },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    paidAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true, collection: 'saas_billings' },
);

saasBillingSchema.index({ hospitalId: 1, createdAt: -1 });
saasBillingSchema.index({ status: 1, createdAt: -1 });

export const SaaSBillingModel =
  mongoose.models.SaaSBilling ||
  mongoose.model<SaaSBillingDocument>('SaaSBilling', saasBillingSchema);
