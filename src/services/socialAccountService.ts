import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { encrypt } from "../lib/encryption";

type PlatformValue = "FACEBOOK" | "INSTAGRAM" | "TWITTER" | "LINKEDIN" | "TIKTOK";

type CreateSocialAccountInput = {
  clientId: string;
  platform: PlatformValue;
  platformUserId: string;
  platformUsername?: string;
  pageId?: string;
  pageName?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  metadata?: Record<string, unknown>;
  lastSyncedAt?: Date;
};

export class SocialAccountOwnershipConflictError extends Error {
  constructor(platform: PlatformValue, platformUserId: string) {
    super(`Social account ${platform}:${platformUserId} is already linked to another client.`);
    this.name = "SocialAccountOwnershipConflictError";
  }
}

export function isSocialAccountOwnershipConflictError(
  err: unknown
): err is SocialAccountOwnershipConflictError {
  return err instanceof SocialAccountOwnershipConflictError;
}

export async function upsertSocialAccount(input: CreateSocialAccountInput) {
  const metadata = input.metadata as Prisma.InputJsonValue | undefined;
  const existing = await prisma.socialAccount.findUnique({
    where: {
      platform_platformUserId: {
        platform: input.platform as never,
        platformUserId: input.platformUserId
      }
    },
    select: { id: true, clientId: true }
  });

  if (existing && existing.clientId !== input.clientId) {
    throw new SocialAccountOwnershipConflictError(input.platform, input.platformUserId);
  }

  return prisma.socialAccount.upsert({
    where: {
      platform_platformUserId: {
        platform: input.platform as never,
        platformUserId: input.platformUserId
      }
    },
    update: {
      encryptedToken: encrypt(input.accessToken),
      encryptedRefreshToken: input.refreshToken ? encrypt(input.refreshToken) : null,
      tokenExpiresAt: input.tokenExpiresAt,
      platformUsername: input.platformUsername,
      pageId: input.pageId,
      pageName: input.pageName,
      metadata,
      lastSyncedAt: input.lastSyncedAt,
      clientId: input.clientId
    },
    create: {
      clientId: input.clientId,
      platform: input.platform as never,
      platformUserId: input.platformUserId,
      platformUsername: input.platformUsername,
      pageId: input.pageId,
      pageName: input.pageName,
      encryptedToken: encrypt(input.accessToken),
      encryptedRefreshToken: input.refreshToken ? encrypt(input.refreshToken) : null,
      tokenExpiresAt: input.tokenExpiresAt,
      metadata,
      lastSyncedAt: input.lastSyncedAt
    }
  });
}
