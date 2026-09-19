import { FilterQuery } from 'mongoose';
import { DoctorModel, DoctorDocument } from '../models/doctor.model';

const POPULATE = { path: 'userId', select: 'firstName lastName email role isActive' };

export class DoctorRepository {
  create(data: Partial<DoctorDocument>) {
    return DoctorModel.create(data);
  }

  findById(id: string) {
    return DoctorModel.findById(id).populate(POPULATE);
  }

  findByUserId(userId: string) {
    return DoctorModel.findOne({ userId }).populate(POPULATE);
  }

  list(filter: FilterQuery<DoctorDocument> = {}) {
    return DoctorModel.find(filter).populate(POPULATE).sort({ department: 1, specialization: 1 });
  }

  updateById(id: string, data: Partial<DoctorDocument>) {
    return DoctorModel.findByIdAndUpdate(id, data, { new: true }).populate(POPULATE);
  }

  count(hospitalId?: string) {
    return DoctorModel.countDocuments(hospitalId ? { hospitalId } : {});
  }
}
