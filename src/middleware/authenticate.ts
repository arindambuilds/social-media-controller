import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../auth/jwt";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: string;
        clientId?: string;
      };
      rawBody?: Buffer;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    req.auth = {
      userId: payload.sub,
      role: payload.role,
      clientId: payload.clientId
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}
