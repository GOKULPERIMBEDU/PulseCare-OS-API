import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';
import { HealthService } from '../services/health.service';
import { HealthRepository } from '../repositories/health.repository';
import { asyncHandler } from '../utils/asyncHandler';

const healthRepository = new HealthRepository();
const healthService = new HealthService(healthRepository);
const healthController = new HealthController(healthService);

const healthRouter = Router();

healthRouter.get('/', asyncHandler(async (req, res) => {
  healthController.getHealth(req, res);
}));

export { healthRouter };
