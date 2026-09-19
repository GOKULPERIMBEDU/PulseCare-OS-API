import { FilterQuery, Types } from 'mongoose';
import { BillingModel, BillingDocument } from '../models/billing.model';

const POPULATE = [
  { path: 'patientId', populate: { path: 'userId', select: 'firstName lastName email' } },
  { path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName email' } },
  { path: 'appointmentId', select: 'date timeSlot status reason' },
];

export class BillingRepository {
  create(data: Partial<BillingDocument>) {
    return BillingModel.create(data);
  }

  findById(id: string) {
    return BillingModel.findById(id).populate(POPULATE);
  }

  list(filter: FilterQuery<BillingDocument> = {}) {
    return BillingModel.find(filter).populate(POPULATE).sort({ createdAt: -1 });
  }

  updateById(id: string, data: Partial<BillingDocument>) {
    return BillingModel.findByIdAndUpdate(id, data, { new: true }).populate(POPULATE);
  }

  revenueSummary(hospitalId: string, from?: Date, to?: Date) {
    const match: Record<string, unknown> = {
      hospitalId: new Types.ObjectId(hospitalId),
      paymentStatus: 'Paid',
    };
    if (from || to) {
      match.paidAt = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }
    return BillingModel.aggregate<{ total: number; count: number }>([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
  }

  pendingTotal(hospitalId: string) {
    return BillingModel.aggregate<{ total: number; count: number }>([
      { $match: { hospitalId: new Types.ObjectId(hospitalId), paymentStatus: 'Pending' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
  }
}
