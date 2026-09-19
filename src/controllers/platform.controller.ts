import { Request, Response } from 'express';
import { PlatformService } from '../services/platform.service';
import { ok, getClientIp } from '../utils/helpers';
import { requireAuthUser } from '../middleware/auth';
import { AppError } from '../types';

const platformService = new PlatformService();

export class PlatformController {
  overview = async (req: Request, res: Response): Promise<void> => {
    ok(res, await platformService.overview(requireAuthUser(req)));
  };

  hospitals = async (req: Request, res: Response): Promise<void> => {
    ok(res, await platformService.listHospitals(requireAuthUser(req)));
  };

  subscriptions = async (req: Request, res: Response): Promise<void> => {
    ok(res, await platformService.listSubscriptions(requireAuthUser(req)));
  };

  createSubscription = async (req: Request, res: Response): Promise<void> => {
    const { hospitalId, plan, billingPeriod, amount, notes } = req.body as Record<string, unknown>;
    if (!hospitalId) {
      throw new AppError('hospitalId is required', 400);
    }
    ok(
      res,
      await platformService.createSubscription(
        requireAuthUser(req),
        {
          hospitalId: String(hospitalId),
          plan: plan as never,
          billingPeriod: billingPeriod as never,
          amount: amount !== undefined ? Number(amount) : undefined,
          notes: notes ? String(notes) : undefined,
        },
        getClientIp(req),
      ),
      201,
    );
  };

  updatePayment = async (req: Request, res: Response): Promise<void> => {
    const { status } = req.body as { status?: 'Paid' | 'Pending' | 'Overdue' };
    if (!status) {
      throw new AppError('status is required', 400);
    }
    ok(
      res,
      await platformService.updatePayment(requireAuthUser(req), req.params.id, status, getClientIp(req)),
    );
  };
}
