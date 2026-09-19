import mongoose from 'mongoose';
import { HealthStatus } from '../types';

export class HealthRepository {
  getDatabaseState(): HealthStatus['database'] {
    return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  }
}
