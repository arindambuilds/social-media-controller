import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export type AuthPayload = {
  sub: string;
  role: string;
  clientId?: string;
};

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
}
