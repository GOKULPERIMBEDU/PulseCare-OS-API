import { Request, Response } from 'express';
import { AppointmentService } from '../services/appointment.service';
import { ok, getClientIp, todayDateString } from '../utils/helpers';
import { requireAuthUser } from '../middleware/auth';
import { AppointmentStatus, AppError } from '../types';
import { requireHospitalId } from '../utils/tenant';

const appointmentService = new AppointmentService();

export class AppointmentController {
  list = async (req: Request, res: Response): Promise<void> => {
    ok(
      res,
      await appointmentService.list(requireAuthUser(req), {
        date: req.query.date ? String(req.query.date) : undefined,
        doctorId: req.query.doctorId ? String(req.query.doctorId) : undefined,
        patientId: req.query.patientId ? String(req.query.patientId) : undefined,
      }),
    );
  };

  get = async (req: Request, res: Response): Promise<void> => {
    ok(res, await appointmentService.getById(req.params.id, requireAuthUser(req)));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { patientId, doctorId, date, timeSlot, reason, notes } = req.body as Record<string, string>;
    if (!doctorId || !date || !timeSlot || !reason) {
      throw new AppError('doctorId, date, timeSlot, and reason are required', 400);
    }
    ok(
      res,
      await appointmentService.create(
        { patientId, doctorId, date, timeSlot, reason, notes },
        requireAuthUser(req),
        getClientIp(req),
      ),
      201,
    );
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const status = req.body?.status as AppointmentStatus;
    if (!status) {
      throw new AppError('status is required', 400);
    }
    ok(
      res,
      await appointmentService.updateStatus(
        req.params.id,
        status,
        requireAuthUser(req),
        getClientIp(req),
      ),
    );
  };

  queue = async (req: Request, res: Response): Promise<void> => {
    const date = req.query.date ? String(req.query.date) : todayDateString();
    const doctorId = req.query.doctorId ? String(req.query.doctorId) : undefined;
    ok(res, await appointmentService.queue(requireHospitalId(requireAuthUser(req)), date, doctorId));
  };
}
