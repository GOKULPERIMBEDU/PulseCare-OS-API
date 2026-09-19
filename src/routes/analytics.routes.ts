import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';

const controller = new AnalyticsController();
const analyticsRouter = Router();

analyticsRouter.use(authenticate, authorize('HOSPITAL_ADMIN'));
analyticsRouter.get('/overview', asyncHandler(controller.overview));
analyticsRouter.get('/audit-logs', asyncHandler(controller.auditLogs));

export { analyticsRouter };
