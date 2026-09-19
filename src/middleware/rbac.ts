import { NextFunction, Request, Response } from 'express';
import { AppError, UserRole } from '../types';

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      next(new AppError('Authentication required', 401));
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      next(new AppError('You are not authorized to perform this action', 403));
      return;
    }
    next();
  };
}
