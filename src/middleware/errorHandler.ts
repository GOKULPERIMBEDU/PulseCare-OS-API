import { NextFunction, Request, Response } from 'express';
import { AppError } from '../types';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    statusCode: 404,
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
    });
    return;
  }

  const maybeMulter = err as { code?: string; message?: string };
  if (maybeMulter.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({
      success: false,
      message: 'File exceeds the 10MB size limit',
      statusCode: 400,
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  const statusCode = 500;

  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    statusCode,
  });
}
