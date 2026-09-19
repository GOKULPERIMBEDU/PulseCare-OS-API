import { Router } from 'express';
import { BillingController } from '../controllers/billing.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';

const controller = new BillingController();
const billingRouter = Router();

billingRouter.use(authenticate);
billingRouter.get('/', asyncHandler(controller.list));
billingRouter.get('/:id', asyncHandler(controller.get));
billingRouter.post('/', authorize('HOSPITAL_ADMIN', 'DOCTOR'), asyncHandler(controller.create));
billingRouter.patch('/:id/payment', authorize('HOSPITAL_ADMIN'), asyncHandler(controller.updatePayment));

export { billingRouter };
