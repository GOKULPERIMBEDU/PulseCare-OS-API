import { FilterQuery } from 'mongoose';
import { PatientModel, PatientDocument } from '../models/patient.model';

const POPULATE = { path: 'userId', select: 'firstName lastName email role isActive' };

export class PatientRepository {
  create(data: Partial<PatientDocument>) {
    return PatientModel.create(data);
  }

  findById(id: string) {
    return PatientModel.findById(id).populate(POPULATE);
  }

  findByUserId(userId: string) {
    return PatientModel.findOne({ userId }).populate(POPULATE);
  }

  list(filter: FilterQuery<PatientDocument> = {}) {
    return PatientModel.find(filter).populate(POPULATE).sort({ createdAt: -1 });
  }

  updateById(id: string, data: Partial<PatientDocument>) {
    return PatientModel.findByIdAndUpdate(id, data, { new: true }).populate(POPULATE);
  }

  count(hospitalId?: string) {
    return PatientModel.countDocuments(hospitalId ? { hospitalId } : {});
  }
}
