import mongoose, { Document, Schema, Types } from 'mongoose';
import { AvailabilityWindow } from '../types';

export interface DoctorDocument extends Document {
  hospitalId: Types.ObjectId;
  userId: Types.ObjectId;
  specialization: string;
  department: string;
  consultationFee: number;
  licenseNumber: string;
  bio?: string;
  availability: AvailabilityWindow[];
  createdAt: Date;
  updatedAt: Date;
}

const availabilitySchema = new Schema<AvailabilityWindow>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    endTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    slotMinutes: { type: Number, required: true, min: 10, max: 120, default: 30 },
  },
  { _id: false },
);

const doctorSchema = new Schema<DoctorDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    specialization: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    consultationFee: { type: Number, required: true, min: 0 },
    licenseNumber: { type: String, required: true, trim: true },
    bio: { type: String },
    availability: { type: [availabilitySchema], default: [] },
  },
  { timestamps: true },
);

doctorSchema.index({ hospitalId: 1, licenseNumber: 1 }, { unique: true });
doctorSchema.index({ hospitalId: 1, department: 1, specialization: 1 });

export const DoctorModel =
  mongoose.models.Doctor || mongoose.model<DoctorDocument>('Doctor', doctorSchema);
