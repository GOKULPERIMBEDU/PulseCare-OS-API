import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ok, getClientIp } from '../utils/helpers';
import { requireAuthUser } from '../middleware/auth';
import { AppError } from '../types';

const authService = new AuthService();

export class AuthController {
  register = async (req: Request, res: Response): Promise<void> => {
    const {
      email,
      password,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      phone,
      address,
      emergencyContacts,
      hospitalId,
      hospitalSlug,
    } = req.body as Record<string, unknown>;
    if (!email || !password || !firstName || !lastName || !dateOfBirth || !gender || !phone || !address) {
      throw new AppError('Missing required registration fields', 400);
    }
    const result = await authService.registerPatient({
      hospitalId: hospitalId ? String(hospitalId) : undefined,
      hospitalSlug: hospitalSlug ? String(hospitalSlug) : undefined,
      email: String(email),
      password: String(password),
      firstName: String(firstName),
      lastName: String(lastName),
      dateOfBirth: String(dateOfBirth),
      gender: gender as 'female' | 'male' | 'other' | 'undisclosed',
      phone: String(phone),
      address: address as never,
      emergencyContacts: emergencyContacts as never,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? undefined,
    });
    ok(res, result, 201);
  };

  registerHospital = async (req: Request, res: Response): Promise<void> => {
    const { name, region, baseCurrency, address, adminContact, admin } = req.body as Record<string, unknown>;
    if (!name || !region || !baseCurrency || !address || !adminContact || !admin) {
      throw new AppError('Missing required hospital registration fields', 400);
    }
    const result = await authService.registerHospital({
      name: String(name),
      region: String(region),
      baseCurrency: baseCurrency as 'INR' | 'USD',
      address: address as never,
      adminContact: adminContact as never,
      admin: admin as never,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? undefined,
    });
    ok(res, result, 201);
  };

  directory = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await authService.directory());
  };

  demoAccounts = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await authService.demoAccounts());
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }
    const result = await authService.login(
      email,
      password,
      getClientIp(req),
      req.get('user-agent') ?? undefined,
    );
    ok(res, result);
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const result = await authService.me(requireAuthUser(req));
    ok(res, result);
  };
}
