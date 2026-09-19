import { Router } from 'express';
import { PlatformController } from '../controllers/platform.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';

const controller = new PlatformController();
const platformRouter = Router();

platformRouter.use(authenticate, authorize('SUPER_ADMIN'));
platformRouter.get('/overview', asyncHandler(controller.overview));
platformRouter.get('/hospitals', asyncHandler(controller.hospitals));
platformRouter.get('/saas-billing', asyncHandler(controller.subscriptions));
platformRouter.post('/saas-billing', asyncHandler(controller.createSubscription));
platformRouter.patch('/saas-billing/:id/payment', asyncHandler(controller.updatePayment));

export { platformRouter };
