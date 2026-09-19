import { AuthUser } from '../types';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      user?: AuthUser;
    }
  }
}

export {};
