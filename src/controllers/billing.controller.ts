import { Request, Response } from 'express';
import { BillingService } from '../services/billing.service';
import { ok, getClientIp } from '../utils/helpers';
import { requireAuthUser } from '../middleware/auth';
import { AppError, PaymentStatus } from '../types';

const billingService = new BillingService();

export class BillingController {
  list = async (req: Request, res: Response): Promise<void> => {
    ok(res, await billingService.list(requireAuthUser(req)));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    ok(res, await billingService.getById(req.params.id, requireAuthUser(req)));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    ok(res, await billingService.create(req.body, requireAuthUser(req), getClientIp(req)), 201);
  };

  updatePayment = async (req: Request, res: Response): Promise<void> => {
    const paymentStatus = req.body?.paymentStatus as PaymentStatus;
    if (paymentStatus !== 'Paid' && paymentStatus !== 'Pending') {
      throw new AppError('paymentStatus must be Paid or Pending', 400);
    }
    ok(
      res,
      await billingService.updatePayment(
        req.params.id,
        paymentStatus,
        requireAuthUser(req),
        getClientIp(req),
      ),
    );
  };
}
