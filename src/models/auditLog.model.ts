import mongoose, { Document, Schema, Types } from 'mongoose';
import { UserRole } from '../types';

export interface AuditLogDocument extends Document {
  hospitalId?: Types.ObjectId;
  userId?: Types.ObjectId;
  role?: UserRole;
  actionType: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'PATIENT'] },
    actionType: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ hospitalId: 1, createdAt: -1 });
auditLogSchema.index({ hospitalId: 1, userId: 1, createdAt: -1 });
auditLogSchema.index({ hospitalId: 1, actionType: 1, createdAt: -1 });

export const AuditLogModel =
  mongoose.models.AuditLog || mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema);
