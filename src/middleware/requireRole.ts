import { NextFunction, Request, Response } from "express";

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      res.status(403).json({ error: "Forbidden." });
      return;
    }

    next();
  };
}
