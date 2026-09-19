import { AuditLogModel } from '../models';
import { UserRole } from '../types';

interface AuditInput {
  hospitalId?: string;
  userId?: string;
  role?: UserRole;
  actionType: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  await AuditLogModel.create(input);
}
