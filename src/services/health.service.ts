import { HealthRepository } from '../repositories/health.repository';
import { HealthStatus } from '../types';

export class HealthService {
  constructor(private readonly healthRepository: HealthRepository) {}

  getStatus(): HealthStatus {
    const database = this.healthRepository.getDatabaseState();

    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      service: 'pulsecare-os-api',
      timestamp: new Date().toISOString(),
      database,
    };
  }
}
