import { FilterQuery } from 'mongoose';
import { UserModel, UserDocument } from '../models/user.model';

export class UserRepository {
  create(data: Partial<UserDocument>) {
    return UserModel.create(data);
  }

  findByEmail(email: string) {
    return UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  }

  findById(id: string) {
    return UserModel.findById(id);
  }

  list(filter: FilterQuery<UserDocument> = {}) {
    return UserModel.find(filter).sort({ lastName: 1, firstName: 1 });
  }

  updateById(id: string, data: Partial<UserDocument>) {
    return UserModel.findByIdAndUpdate(id, data, { new: true });
  }
}
