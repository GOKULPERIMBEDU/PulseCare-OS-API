import { FilterQuery, Types } from 'mongoose';
import { SaaSBillingModel, SaaSBillingDocument } from '../models/saasBilling.model';

const POPULATE = { path: 'hospitalId', select: 'name slug region baseCurrency isActive' };

export class SaaSBillingRepository {
  create(data: Partial<SaaSBillingDocument>) {
    return SaaSBillingModel.create(data);
  }

  findById(id: string) {
    return SaaSBillingModel.findById(id).populate(POPULATE);
  }

  list(filter: FilterQuery<SaaSBillingDocument> = {}) {
    return SaaSBillingModel.find(filter).populate(POPULATE).sort({ createdAt: -1 });
  }

  updateById(id: string, data: Partial<SaaSBillingDocument>) {
    return SaaSBillingModel.findByIdAndUpdate(id, data, { new: true }).populate(POPULATE);
  }

  revenueSummary() {
    return SaaSBillingModel.aggregate<{ total: number; count: number; currency: string }>([
      { $match: { status: 'Paid' } },
      { $group: { _id: '$currency', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $project: { _id: 0, currency: '$_id', total: 1, count: 1 } },
    ]);
  }

  pendingSummary() {
    return SaaSBillingModel.aggregate<{ total: number; count: number; currency: string }>([
      { $match: { status: { $in: ['Pending', 'Overdue'] } } },
      { $group: { _id: '$currency', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $project: { _id: 0, currency: '$_id', total: 1, count: 1 } },
    ]);
  }

  latestByHospital(hospitalId: string) {
    return SaaSBillingModel.findOne({ hospitalId: new Types.ObjectId(hospitalId) }).sort({
      createdAt: -1,
    });
  }
}
