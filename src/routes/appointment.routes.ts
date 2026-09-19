import { Router } from 'express';
import { AppointmentController } from '../controllers/appointment.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';

const controller = new AppointmentController();
const appointmentRouter = Router();

appointmentRouter.use(authenticate);
appointmentRouter.get('/', asyncHandler(controller.list));
appointmentRouter.get('/queue/live', asyncHandler(controller.queue));
appointmentRouter.get('/:id', asyncHandler(controller.get));
appointmentRouter.post('/', asyncHandler(controller.create));
appointmentRouter.patch(
  '/:id/status',
  authorize('HOSPITAL_ADMIN', 'DOCTOR'),
  asyncHandler(controller.updateStatus),
);

export { appointmentRouter };
