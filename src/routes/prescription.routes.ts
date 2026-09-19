import { Router } from 'express';
import { PrescriptionController } from '../controllers/prescription.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';

const controller = new PrescriptionController();
const prescriptionRouter = Router();

prescriptionRouter.use(authenticate);
prescriptionRouter.get('/', asyncHandler(controller.list));
prescriptionRouter.post('/', authorize('HOSPITAL_ADMIN', 'DOCTOR'), asyncHandler(controller.create));

export { prescriptionRouter };
