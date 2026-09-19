import { NextFunction, Request, Response } from 'express';
import { AppError, AuthUser } from '../types';
import { verifyToken } from '../utils/token';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('Authentication required', 401);
    }
    const payload = verifyToken(token);
    if (payload.role !== 'SUPER_ADMIN' && !payload.hospitalId) {
      throw new AppError('Hospital context is missing from this session', 401);
    }
    req.authUser = payload;
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError('Invalid or expired session', 401));
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyToken(token);
    req.authUser = payload;
    req.user = payload;
  } catch {
    // Public endpoints still proceed without a user.
  }
  next();
}

export function requireAuthUser(req: Request): AuthUser {
  if (!req.authUser) {
    throw new AppError('Authentication required', 401);
  }
  return req.authUser;
}
