import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { ok } from '../utils/helpers';
import { requireAuthUser } from '../middleware/auth';

const analyticsService = new AnalyticsService();

export class AnalyticsController {
  overview = async (req: Request, res: Response): Promise<void> => {
    ok(res, await analyticsService.overview(requireAuthUser(req)));
  };

  auditLogs = async (req: Request, res: Response): Promise<void> => {
    const limit = req.query.limit ? Number(req.query.limit) : 200;
    ok(res, await analyticsService.auditLogs(requireAuthUser(req), limit));
  };
}
