import { FilterQuery } from 'mongoose';
import { MedicalDocumentModel, MedicalDocumentRecord } from '../models/document.model';

export class DocumentRepository {
  create(data: Partial<MedicalDocumentRecord>) {
    return MedicalDocumentModel.create(data);
  }

  findById(id: string) {
    return MedicalDocumentModel.findById(id);
  }

  list(filter: FilterQuery<MedicalDocumentRecord> = {}) {
    return MedicalDocumentModel.find(filter)
      .populate({ path: 'uploadedBy', select: 'firstName lastName role' })
      .sort({ createdAt: -1 });
  }
}
