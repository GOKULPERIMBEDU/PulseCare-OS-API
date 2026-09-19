import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { patientRouter } from './patient.routes';
import { doctorRouter } from './doctor.routes';
import { appointmentRouter } from './appointment.routes';
import { prescriptionRouter } from './prescription.routes';
import { billingRouter } from './billing.routes';
import { documentRouter } from './document.routes';
import { analyticsRouter } from './analytics.routes';
import { platformRouter } from './platform.routes';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/patients', patientRouter);
router.use('/doctors', doctorRouter);
router.use('/appointments', appointmentRouter);
router.use('/prescriptions', prescriptionRouter);
router.use('/billing', billingRouter);
router.use('/documents', documentRouter);
router.use('/analytics', analyticsRouter);
router.use('/platform', platformRouter);

export { router as apiRouter };
