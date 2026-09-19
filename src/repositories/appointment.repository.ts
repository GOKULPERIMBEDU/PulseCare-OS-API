import { Types } from 'mongoose';
import { FilterQuery } from 'mongoose';
import { AppointmentModel, AppointmentDocument } from '../models/appointment.model';
import { ACTIVE_APPOINTMENT_STATUSES, AppointmentStatus } from '../types';

const POPULATE = [
  { path: 'patientId', populate: { path: 'userId', select: 'firstName lastName email' } },
  { path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName email' } },
];

export class AppointmentRepository {
  create(data: Partial<AppointmentDocument>) {
    return AppointmentModel.create(data);
  }

  findById(id: string) {
    return AppointmentModel.findById(id).populate(POPULATE);
  }

  findConflict(hospitalId: string, doctorId: string, date: string, timeSlot: string, excludeId?: string) {
    const filter: FilterQuery<AppointmentDocument> = {
      hospitalId,
      doctorId,
      date,
      timeSlot,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    return AppointmentModel.findOne(filter);
  }

  list(filter: FilterQuery<AppointmentDocument> = {}) {
    return AppointmentModel.find(filter).populate(POPULATE).sort({ date: 1, timeSlot: 1 });
  }

  listBookedSlots(hospitalId: string, doctorId: string, date: string) {
    return AppointmentModel.find({
      hospitalId,
      doctorId,
      date,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    }).select('timeSlot endTime status');
  }

  updateById(id: string, data: Partial<AppointmentDocument>) {
    return AppointmentModel.findByIdAndUpdate(id, data, { new: true }).populate(POPULATE);
  }

  count(filter: FilterQuery<AppointmentDocument> = {}) {
    return AppointmentModel.countDocuments(filter);
  }

  countByStatus(hospitalId: string, date: string) {
    return AppointmentModel.aggregate<{ _id: AppointmentStatus; count: number }>([
      { $match: { hospitalId: new Types.ObjectId(hospitalId), date } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
  }
}
