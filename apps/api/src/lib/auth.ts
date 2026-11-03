import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { HttpError } from './http.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(u: AuthUser) {
  return jwt.sign(u, SECRET, { expiresIn: '7d' });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return next(new HttpError(401, 'Not authenticated'));
  try {
    const p = jwt.verify(token, SECRET) as AuthUser;
    req.user = { id: p.id, role: p.role, email: p.email, name: p.name };
    next();
  } catch {
    next(new HttpError(401, 'Session expired, please log in again'));
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Not authenticated'));
    if (req.user.role !== 'SUPER_ADMIN' && !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have access to this'));
    }
    next();
  };

export function me(req: Request): AuthUser {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}
