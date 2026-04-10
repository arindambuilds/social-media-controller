import { PrismaClient } from "../src/generated/prisma";
import { decryptWithKeySources, encryptWithKeySource } from "../src/lib/encryption";
import { env } from "../src/config/env";

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

function resolvePrimaryKeySource(): string {
  return env.ENCRYPTION_KEY && env.ENCRYPTION_KEY.length >= 32
    ? env.ENCRYPTION_KEY
    : env.JWT_SECRET;
}

function resolvePreviousKeySource(): string {
  const prev = env.ENCRYPTION_KEY_PREV?.trim();
  if (!prev || prev.length < 32) {
    throw new Error(
      "ENCRYPTION_KEY_PREV must be set to the previous encryption key material before running re-encryption."
    );
  }
  return prev;
}

function parseArgs(argv: string[]): { write: boolean } {
  return {
    write: argv.includes("--write")
  };
}

function rotateRefreshTokenIfNeeded(
  encryptedRefreshToken: string | null,
  primaryKeySource: string,
  previousKeySource: string
): { encryptedRefreshToken: string | null; rotated: boolean } {
  if (!encryptedRefreshToken) {
    return { encryptedRefreshToken: null, rotated: false };
  }

  try {
    decryptWithKeySources(encryptedRefreshToken, [primaryKeySource]);
    return { encryptedRefreshToken, rotated: false };
  } catch {
    const previousRefresh = decryptWithKeySources(encryptedRefreshToken, [previousKeySource]);
    return {
      encryptedRefreshToken: encryptWithKeySource(previousRefresh, primaryKeySource),
      rotated: true
    };
  }
}

async function main(): Promise<void> {
  const { write } = parseArgs(process.argv.slice(2));
  const primaryKeySource = resolvePrimaryKeySource();
  const previousKeySource = resolvePreviousKeySource();

  if (primaryKeySource === previousKeySource) {
    throw new Error("ENCRYPTION_KEY_PREV matches the active encryption key. Rotation would be a no-op.");
  }

  let cursor: string | undefined;
  let scanned = 0;
  let alreadyPrimary = 0;
  let rotated = 0;
  let failed = 0;

  console.log(
    `[reencrypt-social-accounts] Starting ${write ? "write" : "dry-run"} mode for SocialAccount tokens.`
  );

  while (true) {
    const rows = await prisma.socialAccount.findMany({
      take: BATCH_SIZE,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor }
          }
        : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        encryptedToken: true,
        encryptedRefreshToken: true
      }
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      cursor = row.id;

      try {
        const primaryToken = decryptWithKeySources(row.encryptedToken, [primaryKeySource]);
        let nextEncryptedToken = row.encryptedToken;
        let nextEncryptedRefreshToken = row.encryptedRefreshToken;
        let needsWrite = false;

        const refreshRotation = rotateRefreshTokenIfNeeded(
          row.encryptedRefreshToken,
          primaryKeySource,
          previousKeySource
        );
        nextEncryptedRefreshToken = refreshRotation.encryptedRefreshToken;
        if (refreshRotation.rotated) {
          needsWrite = true;
        }

        if (needsWrite) {
          if (write) {
            await prisma.socialAccount.update({
              where: { id: row.id },
              data: {
                encryptedToken: nextEncryptedToken,
                encryptedRefreshToken: nextEncryptedRefreshToken
              }
            });
          }
          rotated += 1;
          continue;
        }

        void primaryToken;
        alreadyPrimary += 1;
      } catch {
        try {
          const previousToken = decryptWithKeySources(row.encryptedToken, [previousKeySource]);
          const nextEncryptedToken = encryptWithKeySource(previousToken, primaryKeySource);

          const refreshRotation = rotateRefreshTokenIfNeeded(
            row.encryptedRefreshToken,
            primaryKeySource,
            previousKeySource
          );
          const nextEncryptedRefreshToken = refreshRotation.encryptedRefreshToken;

          if (write) {
            await prisma.socialAccount.update({
              where: { id: row.id },
              data: {
                encryptedToken: nextEncryptedToken,
                encryptedRefreshToken: nextEncryptedRefreshToken
              }
            });
          }
          rotated += 1;
        } catch (err) {
          failed += 1;
          console.error(
            `[reencrypt-social-accounts] Failed to process socialAccount=${row.id}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }
    }
  }

  console.log(
    `[reencrypt-social-accounts] Completed ${write ? "write" : "dry-run"}: scanned=${scanned} alreadyPrimary=${alreadyPrimary} rotated=${rotated} failed=${failed}`
  );

  if (!write) {
    console.log("[reencrypt-social-accounts] Dry run only. Re-run with --write to persist updates.");
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
