import { Router } from 'express';
import { PatientController } from '../controllers/patient.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';

const controller = new PatientController();
const patientRouter = Router();

patientRouter.use(authenticate);
patientRouter.get('/', asyncHandler(controller.list));
patientRouter.get('/:id', asyncHandler(controller.get));
patientRouter.post('/', authorize('HOSPITAL_ADMIN'), asyncHandler(controller.create));
patientRouter.patch('/:id', authorize('HOSPITAL_ADMIN', 'DOCTOR', 'PATIENT'), asyncHandler(controller.update));

export { patientRouter };
