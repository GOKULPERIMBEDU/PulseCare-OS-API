import { Request, Response } from 'express';
import { DoctorService } from '../services/doctor.service';
import { ok, getClientIp } from '../utils/helpers';
import { requireAuthUser } from '../middleware/auth';
import { AppError } from '../types';

const doctorService = new DoctorService();

export class DoctorController {
  list = async (req: Request, res: Response): Promise<void> => {
    ok(res, await doctorService.list(requireAuthUser(req)));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    ok(res, await doctorService.getById(req.params.id, requireAuthUser(req)));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    ok(res, await doctorService.create(req.body, requireAuthUser(req), getClientIp(req)), 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    ok(
      res,
      await doctorService.update(req.params.id, req.body, requireAuthUser(req), getClientIp(req)),
    );
  };

  availability = async (req: Request, res: Response): Promise<void> => {
    const date = String(req.query.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError('Query param date=YYYY-MM-DD is required', 400);
    }
    ok(res, await doctorService.availability(req.params.id, date, requireAuthUser(req)));
  };
}
