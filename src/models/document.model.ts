import mongoose, { Document, Schema, Types } from 'mongoose';
import { DocumentCategory } from '../types';

export interface MedicalDocumentRecord extends Document {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  appointmentId?: Types.ObjectId;
  category: DocumentCategory;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  createdAt: Date;
}

const medicalDocumentSchema = new Schema<MedicalDocumentRecord>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    category: { type: String, enum: ['report', 'lab', 'prescription', 'other'], required: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storagePath: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

medicalDocumentSchema.index({ hospitalId: 1, patientId: 1, createdAt: -1 });

export const MedicalDocumentModel =
  mongoose.models.MedicalDocument ||
  mongoose.model<MedicalDocumentRecord>('MedicalDocument', medicalDocumentSchema);
