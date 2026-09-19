import mongoose, { Document, Schema, Types } from 'mongoose';
import { MedicationItem } from '../types';

export interface PrescriptionDocument extends Document {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  appointmentId: Types.ObjectId;
  medications: MedicationItem[];
  notes?: string;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const medicationSchema = new Schema<MedicationItem>(
  {
    name: { type: String, required: true, trim: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    duration: { type: String, required: true },
    instructions: { type: String },
  },
  { _id: false },
);

const prescriptionSchema = new Schema<PrescriptionDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    medications: {
      type: [medicationSchema],
      validate: [(value: MedicationItem[]) => value.length > 0, 'At least one medication is required'],
    },
    notes: { type: String },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

prescriptionSchema.index({ hospitalId: 1, patientId: 1, issuedAt: -1 });
prescriptionSchema.index({ hospitalId: 1, doctorId: 1, issuedAt: -1 });

export const PrescriptionModel =
  mongoose.models.Prescription ||
  mongoose.model<PrescriptionDocument>('Prescription', prescriptionSchema);
