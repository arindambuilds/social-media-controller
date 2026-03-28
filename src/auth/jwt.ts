import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export type AuthPayload = {
  sub: string;
  email?: string;
  role: string;
  clientId?: string;
};

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: "HS256"
  });
}

export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: "HS256"
  });
}

export function verifyAccessToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"]
  }) as AuthPayload;
}

export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: ["HS256"]
  }) as AuthPayload;
}
