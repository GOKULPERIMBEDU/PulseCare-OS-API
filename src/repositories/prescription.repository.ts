import { FilterQuery } from 'mongoose';
import { PrescriptionModel, PrescriptionDocument } from '../models/prescription.model';

const POPULATE = [
  { path: 'patientId', populate: { path: 'userId', select: 'firstName lastName email' } },
  { path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName email' } },
  { path: 'appointmentId', select: 'date timeSlot status reason' },
];

export class PrescriptionRepository {
  create(data: Partial<PrescriptionDocument>) {
    return PrescriptionModel.create(data);
  }

  findById(id: string) {
    return PrescriptionModel.findById(id).populate(POPULATE);
  }

  findByAppointmentId(appointmentId: string) {
    return PrescriptionModel.findOne({ appointmentId }).populate(POPULATE);
  }

  list(filter: FilterQuery<PrescriptionDocument> = {}) {
    return PrescriptionModel.find(filter).populate(POPULATE).sort({ issuedAt: -1 });
  }
}
