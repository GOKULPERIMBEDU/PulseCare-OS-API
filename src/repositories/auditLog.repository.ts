import { FilterQuery } from 'mongoose';
import { AuditLogModel, AuditLogDocument } from '../models/auditLog.model';

export class AuditLogRepository {
  list(filter: FilterQuery<AuditLogDocument> = {}, limit = 200) {
    return AuditLogModel.find(filter)
      .populate({ path: 'userId', select: 'firstName lastName email role' })
      .sort({ createdAt: -1 })
      .limit(limit);
  }
}
