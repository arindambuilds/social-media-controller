import { prisma } from "../lib/prisma";
import { encrypt } from "../lib/encryption";

type PlatformValue = "FACEBOOK" | "INSTAGRAM" | "TWITTER" | "LINKEDIN" | "TIKTOK";

type CreateSocialAccountInput = {
  clientId: string;
  platform: PlatformValue;
  platformUserId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
};

export async function upsertSocialAccount(input: CreateSocialAccountInput) {
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
      clientId: input.clientId
    },
    create: {
      clientId: input.clientId,
      platform: input.platform as never,
      platformUserId: input.platformUserId,
      encryptedToken: encrypt(input.accessToken),
      encryptedRefreshToken: input.refreshToken ? encrypt(input.refreshToken) : null,
      tokenExpiresAt: input.tokenExpiresAt
    }
  });
}
