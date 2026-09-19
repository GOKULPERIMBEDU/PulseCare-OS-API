import { HospitalModel, HospitalDocument } from '../models/hospital.model';

export class HospitalRepository {
  create(data: Partial<HospitalDocument>) {
    return HospitalModel.create(data);
  }

  findById(id: string) {
    return HospitalModel.findById(id);
  }

  findBySlug(slug: string) {
    return HospitalModel.findOne({ slug: slug.toLowerCase(), isActive: true });
  }

  findByName(name: string) {
    return HospitalModel.findOne({ name });
  }

  directory() {
    return HospitalModel.find({ isActive: true })
      .select('name slug region baseCurrency')
      .sort({ name: 1 });
  }

  listAll() {
    return HospitalModel.find().sort({ createdAt: -1 });
  }

  count(filter: Record<string, unknown> = {}) {
    return HospitalModel.countDocuments(filter);
  }
}
