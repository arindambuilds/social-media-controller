import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../auth/jwt";
import { env } from "../config/env";
import { ACCESS_COOKIE } from "../lib/authCookies";

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
  let token: string | undefined;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    token = header.slice(7);
  } else if (env.AUTH_HTTPONLY_COOKIES) {
    const c = req.cookies?.[ACCESS_COOKIE];
    if (typeof c === "string" && c.length > 0) token = c;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Please log in again." }
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      role: payload.role,
      clientId: payload.clientId
    };
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Please log in again." }
    });
  }
}
