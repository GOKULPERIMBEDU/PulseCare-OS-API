import { Router } from 'express';
import { DoctorController } from '../controllers/doctor.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';

const controller = new DoctorController();
const doctorRouter = Router();

doctorRouter.use(authenticate);
doctorRouter.get('/', asyncHandler(controller.list));
doctorRouter.get('/:id/availability', asyncHandler(controller.availability));
doctorRouter.get('/:id', asyncHandler(controller.get));
doctorRouter.post('/', authorize('HOSPITAL_ADMIN'), asyncHandler(controller.create));
doctorRouter.patch('/:id', authorize('HOSPITAL_ADMIN'), asyncHandler(controller.update));

export { doctorRouter };
