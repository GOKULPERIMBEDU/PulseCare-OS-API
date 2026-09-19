import mongoose, { Document, Schema, Types } from 'mongoose';
import { AppointmentStatus } from '../types';

export interface AppointmentDocument extends Document {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  date: string;
  timeSlot: string;
  endTime: string;
  reason: string;
  notes?: string;
  status: AppointmentStatus;
  checkedInAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<AppointmentDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    timeSlot: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    endTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    reason: { type: String, required: true, trim: true },
    notes: { type: String },
    status: {
      type: String,
      enum: ['Scheduled', 'Waiting', 'In-Consultation', 'Completed', 'Cancelled'],
      default: 'Scheduled',
    },
    checkedInAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

appointmentSchema.index({ hospitalId: 1, doctorId: 1, date: 1, timeSlot: 1 });
appointmentSchema.index({ hospitalId: 1, patientId: 1, date: -1 });
appointmentSchema.index({ hospitalId: 1, doctorId: 1, date: 1, status: 1 });

export const AppointmentModel =
  mongoose.models.Appointment ||
  mongoose.model<AppointmentDocument>('Appointment', appointmentSchema);
