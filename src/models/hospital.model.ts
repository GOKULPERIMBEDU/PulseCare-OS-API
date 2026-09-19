import mongoose, { Document, Schema } from 'mongoose';
import { Address, BaseCurrency } from '../types';

export interface HospitalAdminContact {
  name: string;
  email: string;
  phone: string;
}

export interface HospitalDocument extends Document {
  name: string;
  slug: string;
  address: Address;
  region: string;
  baseCurrency: BaseCurrency;
  adminContact: HospitalAdminContact;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<Address>(
  {
    line1: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true, default: 'US' },
  },
  { _id: false },
);

const adminContactSchema = new Schema<HospitalAdminContact>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const hospitalSchema = new Schema<HospitalDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    address: { type: addressSchema, required: true },
    region: { type: String, required: true, trim: true },
    baseCurrency: { type: String, enum: ['INR', 'USD'], required: true },
    adminContact: { type: adminContactSchema, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

hospitalSchema.index({ region: 1, name: 1 });

export const HospitalModel =
  mongoose.models.Hospital || mongoose.model<HospitalDocument>('Hospital', hospitalSchema);
