import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import rateLimit from 'express-rate-limit';

const authController = new AuthController();
const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again later.', statusCode: 429 },
});

authRouter.post('/register', asyncHandler(authController.register));
authRouter.post('/register-hospital', asyncHandler(authController.registerHospital));
authRouter.get('/hospitals', asyncHandler(authController.directory));
authRouter.get('/demo-accounts', asyncHandler(authController.demoAccounts));
authRouter.post('/login', loginLimiter, asyncHandler(authController.login));
authRouter.get('/me', authenticate, asyncHandler(authController.me));

export { authRouter };
