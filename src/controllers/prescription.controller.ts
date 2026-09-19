import { Request, Response } from 'express';
import { PrescriptionService } from '../services/prescription.service';
import { ok, getClientIp } from '../utils/helpers';
import { requireAuthUser } from '../middleware/auth';
import { AppError } from '../types';

const prescriptionService = new PrescriptionService();

export class PrescriptionController {
  list = async (req: Request, res: Response): Promise<void> => {
    ok(
      res,
      await prescriptionService.list(
        requireAuthUser(req),
        req.query.patientId ? String(req.query.patientId) : undefined,
      ),
    );
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { appointmentId, medications, notes } = req.body as {
      appointmentId?: string;
      medications?: never;
      notes?: string;
    };
    if (!appointmentId) {
      throw new AppError('appointmentId is required', 400);
    }
    ok(
      res,
      await prescriptionService.create(
        { appointmentId, medications: medications ?? [], notes },
        requireAuthUser(req),
        getClientIp(req),
      ),
      201,
    );
  };
}
