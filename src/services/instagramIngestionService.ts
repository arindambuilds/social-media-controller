import { decrypt } from "../lib/encryption";
import { prisma } from "../lib/prisma";

type InstagramMediaResponse = {
  data: Array<{
    id: string;
    caption?: string;
    media_type?: string;
    media_url?: string;
    permalink?: string;
    timestamp: string;
    like_count?: number;
    comments_count?: number;
  }>;
};

type InstagramInsightResponse = {
  data: Array<{
    name: string;
    values: Array<{ value: number | Record<string, number> }>;
  }>;
};

export async function syncInstagramSocialAccount(socialAccountId: string) {
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

  try {
    const accessToken = decrypt(socialAccount.encryptedToken);
    const media = await fetchJson<InstagramMediaResponse>(
      `https://graph.instagram.com/${socialAccount.platformUserId}/media?${new URLSearchParams({
        fields: "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count",
        access_token: accessToken
      }).toString()}`
    );

    let recordsFetched = 0;
    const snapshotDate = startOfUtcDay(new Date());

    for (const item of media.data) {
      const post = await prisma.post.upsert({
        where: {
          socialAccountId_platformPostId: {
            socialAccountId: socialAccount.id,
            platformPostId: item.id
          }
        },
        update: {
          content: item.caption ?? null,
          mediaUrl: item.media_url ?? item.permalink ?? null,
          publishedAt: new Date(item.timestamp)
        },
        create: {
          socialAccountId: socialAccount.id,
          platformPostId: item.id,
          content: item.caption ?? null,
          mediaUrl: item.media_url ?? item.permalink ?? null,
          publishedAt: new Date(item.timestamp)
        }
      });

      const metrics = await fetchInstagramMetrics(item.id, accessToken);
      const likes = item.like_count ?? 0;
      const commentsCount = item.comments_count ?? 0;
      const shares = metrics.shares ?? 0;
      const saves = metrics.saved ?? 0;
      const impressions = metrics.impressions ?? 0;
      const reach = metrics.reach ?? 0;
      const engagementRate = reach > 0 ? (likes + commentsCount + shares + saves) / reach : null;

      await prisma.post.update({
        where: { id: post.id },
        data: {
          engagementStats: {
            likes,
            commentsCount,
            shares,
            saves,
            impressions,
            reach,
            engagementRate
          }
        }
      });

      await prisma.postInsight.create({
        data: {
          postId: post.id,
          date: snapshotDate,
          likes,
          commentsCount,
          shares,
          impressions,
          reach
        }
      });

      await prisma.postMetricDaily.upsert({
        where: {
          postId_date: {
            postId: post.id,
            date: snapshotDate
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
          postId: post.id,
          date: snapshotDate,
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
      data: {
        lastSyncedAt: new Date()
      }
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
        errorMessage: error instanceof Error ? error.message : "Unknown Instagram sync error"
      }
    });

    throw error;
  }
}

async function fetchInstagramMetrics(mediaId: string, accessToken: string) {
  try {
    const response = await fetchJson<InstagramInsightResponse>(
      `https://graph.facebook.com/v19.0/${mediaId}/insights?${new URLSearchParams({
        metric: "reach,impressions,saved,shares",
        access_token: accessToken
      }).toString()}`
    );

    return response.data.reduce<Record<string, number>>((acc, metric) => {
      const raw = metric.values[0]?.value;
      acc[metric.name] = typeof raw === "number" ? raw : 0;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const errorObject = payload.error as { message?: string } | undefined;
    throw new Error(errorObject?.message ?? response.statusText);
  }

  return payload as T;
}
