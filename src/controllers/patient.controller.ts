import { Request, Response } from 'express';
import { PatientService } from '../services/patient.service';
import { ok, getClientIp } from '../utils/helpers';
import { requireAuthUser } from '../middleware/auth';

const patientService = new PatientService();

export class PatientController {
  list = async (req: Request, res: Response): Promise<void> => {
    ok(res, await patientService.list(requireAuthUser(req)));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    ok(res, await patientService.getById(req.params.id, requireAuthUser(req)));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    ok(
      res,
      await patientService.create(req.body, requireAuthUser(req), getClientIp(req)),
      201,
    );
  };

  update = async (req: Request, res: Response): Promise<void> => {
    ok(
      res,
      await patientService.update(req.params.id, req.body, requireAuthUser(req), getClientIp(req)),
    );
  };
}
