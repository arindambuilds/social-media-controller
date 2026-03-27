import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../auth/jwt";

const BCRYPT_ROUNDS = 12;

export async function signup(input: {
  email: string;
  password: string;
  name: string;
  role?: "AGENCY_ADMIN" | "CLIENT_USER";
  clientId?: string;
}) {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    throw new Error("A user with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      passwordHash,
      role: input.role ?? "CLIENT_USER",
      client: input.clientId
        ? {
            connect: { id: input.clientId }
          }
        : undefined
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      clientId: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    clientId: user.clientId ?? undefined
  };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user
  };
}

export async function login(input: { email: string; password: string }) {
  const email = input.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      clientId: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!user?.passwordHash) {
    throw new Error("Invalid email or password.");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password.");
  }

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    clientId: user.clientId ?? undefined
  };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user
  };
}

export async function refresh(refreshToken: string) {
  const claims = verifyRefreshToken(refreshToken);
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      clientId: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    clientId: user.clientId ?? undefined
  };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user
  };
}
