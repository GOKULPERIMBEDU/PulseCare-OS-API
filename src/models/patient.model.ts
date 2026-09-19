import mongoose, { Document, Schema, Types } from 'mongoose';
import { Address, EmergencyContact, Gender, MedicalHistoryReference } from '../types';

export interface PatientDocument extends Document {
  hospitalId: Types.ObjectId;
  userId: Types.ObjectId;
  mrn: string;
  dateOfBirth: Date;
  gender: Gender;
  bloodGroup?: string;
  phone: string;
  address: Address;
  emergencyContacts: EmergencyContact[];
  medicalHistory: MedicalHistoryReference[];
  allergies: string[];
  chronicConditions: string[];
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

const emergencyContactSchema = new Schema<EmergencyContact>(
  {
    name: { type: String, required: true },
    relationship: { type: String, required: true },
    phone: { type: String, required: true },
  },
  { _id: false },
);

const medicalHistorySchema = new Schema<MedicalHistoryReference>(
  {
    title: { type: String, required: true },
    note: { type: String },
    recordedAt: { type: Date, default: Date.now },
    documentId: { type: String },
  },
  { _id: false },
);

const patientSchema = new Schema<PatientDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    mrn: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['female', 'male', 'other', 'undisclosed'], required: true },
    bloodGroup: { type: String },
    phone: { type: String, required: true },
    address: { type: addressSchema, required: true },
    emergencyContacts: { type: [emergencyContactSchema], default: [] },
    medicalHistory: { type: [medicalHistorySchema], default: [] },
    allergies: { type: [String], default: [] },
    chronicConditions: { type: [String], default: [] },
  },
  { timestamps: true },
);

patientSchema.index({ hospitalId: 1, mrn: 1 }, { unique: true });
patientSchema.index({ hospitalId: 1, createdAt: -1 });
patientSchema.index({ phone: 1 });

export const PatientModel =
  mongoose.models.Patient || mongoose.model<PatientDocument>('Patient', patientSchema);
