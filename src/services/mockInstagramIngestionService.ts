import crypto from "crypto";
import { prisma } from "../lib/prisma";

type Rng = () => number;

export async function syncMockInstagramSocialAccount(socialAccountId: string) {
  const socialAccount = await prisma.socialAccount.findUnique({
    where: { id: socialAccountId }
  });

  if (!socialAccount) {
    throw new Error("Social account not found.");
  }

  const syncRun = await prisma.syncRun.create({
    data: {
      clientId: socialAccount.clientId,
      socialAccountId: socialAccount.id,
      platform: "INSTAGRAM",
      status: "RUNNING",
      trigger: "SCHEDULED"
    }
  });

  const rng = seededRng(socialAccountId);

  try {
    const now = new Date();
    const today = startOfUtcDay(now);

    // Create a realistic-ish pool of posts across last 30 days.
    const postCount = 24 + Math.floor(rng() * 18); // 24..41
    const posts: Array<{ postId: string; publishedAt: Date; caption: string }> = [];

    for (let i = 0; i < postCount; i += 1) {
      const publishedAt = randomPublishedAtLast30Days(rng, now);
      const caption = generateCaption(rng);
      const platformPostId = `mock_${hash(`${socialAccountId}:${i}`)}`;

      const post = await prisma.post.upsert({
        where: {
          socialAccountId_platformPostId: {
            socialAccountId: socialAccount.id,
            platformPostId
          }
        },
        update: {
          content: caption,
          mediaUrl: `https://picsum.photos/seed/${platformPostId}/800/800`,
          publishedAt
        },
        create: {
          socialAccountId: socialAccount.id,
          platformPostId,
          content: caption,
          mediaUrl: `https://picsum.photos/seed/${platformPostId}/800/800`,
          publishedAt
        }
      });

      posts.push({ postId: post.id, publishedAt, caption });
    }

    // For each post, upsert a daily metric for today (like your real ingestion).
    // This makes analytics immediately usable without storing 30 days per post.
    let recordsFetched = 0;

    for (const post of posts) {
      const hour = post.publishedAt.getHours();
      const captionLen = post.caption.length;

      // Bias: night posts do better, and shorter captions slightly better.
      const nightBoost = hour >= 19 || hour <= 1 ? 1.25 : 1.0;
      const captionBoost = captionLen < 90 ? 1.15 : captionLen < 180 ? 1.0 : 0.9;
      const quality = clamp(0.6 + rng() * 0.9, 0.6, 1.5) * nightBoost * captionBoost;

      const reach = Math.floor(250 + rng() * 2000 * quality);
      const impressions = Math.floor(reach * clamp(1.05 + rng() * 0.8, 1.05, 2.2));
      const likes = Math.floor(reach * clamp(0.04 + rng() * 0.08, 0.03, 0.15));
      const commentsCount = Math.floor(likes * clamp(0.05 + rng() * 0.12, 0.03, 0.2));
      const shares = Math.floor(likes * clamp(0.02 + rng() * 0.06, 0.01, 0.12));
      const saves = Math.floor(likes * clamp(0.03 + rng() * 0.09, 0.01, 0.15));
      const engagementRate = reach > 0 ? (likes + commentsCount + shares + saves) / reach : null;

      await prisma.postMetricDaily.upsert({
        where: {
          postId_date: {
            postId: post.postId,
            date: today
          }
        },
        update: {
          likes,
          commentsCount,
          shares,
          saves,
          impressions,
          reach,
          engagementRate
        },
        create: {
          postId: post.postId,
          date: today,
          likes,
          commentsCount,
          shares,
          saves,
          impressions,
          reach,
          engagementRate
        }
      });

      recordsFetched += 1;
    }

    await prisma.socialAccount.update({
      where: { id: socialAccount.id },
      data: { lastSyncedAt: new Date() }
    });

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        recordsFetched
      }
    });

    return { recordsFetched };
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown mock sync error"
      }
    });
    throw error;
  }
}

function seededRng(seed: string): Rng {
  let state = BigInt("0x" + hash(seed));
  const m = BigInt("0xffffffffffffffff"); // 2^64-1

  return () => {
    // xorshift64*
    state ^= state >> BigInt(12);
    state ^= state << BigInt(25);
    state ^= state >> BigInt(27);
    state = (state * BigInt("2685821657736338717")) & m;
    // Convert to [0,1)
    return Number(state % BigInt(1_000_000)) / 1_000_000;
  };
}

function hash(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomPublishedAtLast30Days(rng: Rng, now: Date) {
  const daysBack = Math.floor(rng() * 30);
  const base = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  // Prefer posting windows: 12-14 and 19-22
  const slot = rng();
  const hour =
    slot < 0.15
      ? 10 + Math.floor(rng() * 3) // 10-12
      : slot < 0.45
        ? 12 + Math.floor(rng() * 3) // 12-14
        : slot < 0.85
          ? 19 + Math.floor(rng() * 4) // 19-22
          : 16 + Math.floor(rng() * 2); // 16-17

  base.setHours(hour, Math.floor(rng() * 60), 0, 0);
  return base;
}

function generateCaption(rng: Rng) {
  const hooks = [
    "Small change, big glow-up.",
    "Bhubaneswar, you’ll love this.",
    "Before → After (wait for it).",
    "Quick tip that actually works.",
    "Save this for later."
  ];
  const bodies = [
    "If you’ve been struggling with frizz, try this routine for 7 days.",
    "Our client wanted a clean, low-maintenance look and this is the result.",
    "The secret is consistency + the right product for your hair type.",
    "Simple steps, visible results — no complicated jargon.",
    "Want the same result? We’ll guide you based on your hair/skin type."
  ];
  const ctas = [
    "DM to book your slot.",
    "Comment “INFO” and we’ll share details.",
    "Tap the link in bio to book.",
    "Send us your question — we reply fast.",
    "Share this with a friend who needs it."
  ];
  const hashtags = ["#bhubaneswar", "#odisha", "#salon", "#beauty", "#selfcare", "#localbusiness"];

  const hook = hooks[Math.floor(rng() * hooks.length)];
  const body = bodies[Math.floor(rng() * bodies.length)];
  const cta = ctas[Math.floor(rng() * ctas.length)];
  const tagCount = 5 + Math.floor(rng() * 3);
  const tagList = shuffle(hashtags, rng).slice(0, tagCount).join(" ");

  const maybeShort = rng() < 0.4;
  if (maybeShort) {
    return `${hook}\n\n${cta}\n\n${tagList}`;
  }

  return `${hook}\n\n${body}\n\n${cta}\n\n${tagList}`;
}

function shuffle<T>(values: T[], rng: Rng) {
  const arr = [...values];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

