import { prisma } from "../lib/prisma";

export async function getInstagramAnalyticsSummary(clientId: string) {
  const posts = await prisma.post.findMany({
    where: {
      socialAccount: {
        clientId,
        platform: "INSTAGRAM"
      }
    },
    include: {
      dailyMetrics: true
    },
    orderBy: {
      publishedAt: "desc"
    }
  });

  type FlattenedPost = {
    id: string;
    caption: string;
    publishedAt: Date;
    captionLength: number;
    engagementRate: number;
    likes: number;
    commentsCount: number;
  };

  const flattened: FlattenedPost[] = posts.map((post) => {
    const latest = [...post.dailyMetrics].sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    const engagementRate = latest?.engagementRate ?? 0;

    return {
      id: post.id,
      caption: post.content ?? "",
      publishedAt: post.publishedAt,
      captionLength: (post.content ?? "").length,
      engagementRate,
      likes: latest?.likes ?? 0,
      commentsCount: latest?.commentsCount ?? 0
    };
  });

  const hourBuckets = new Map<number, number[]>();
  const captionBuckets = new Map<string, number[]>();

  for (const post of flattened) {
    const hour = post.publishedAt.getHours();
    hourBuckets.set(hour, [...(hourBuckets.get(hour) ?? []), post.engagementRate]);

    const bucket =
      post.captionLength < 80 ? "short" : post.captionLength < 180 ? "medium" : "long";
    captionBuckets.set(bucket, [...(captionBuckets.get(bucket) ?? []), post.engagementRate]);
  }

  const topHours = [...hourBuckets.entries()]
    .map(([hour, values]) => ({
      hour,
      avgEngagementRate: average(values)
    }))
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
    .slice(0, 3);

  const captionPerformance = [...captionBuckets.entries()].map(([bucket, values]) => ({
    bucket,
    avgEngagementRate: average(values)
  }));

  const sorted = [...flattened].sort((a, b) => b.engagementRate - a.engagementRate);

  return {
    postsAnalyzed: flattened.length,
    topHours,
    captionPerformance,
    topPosts: sorted.slice(0, 5),
    worstPosts: [...sorted].reverse().slice(0, 5),
    averageEngagementRate: average(flattened.map((post) => post.engagementRate))
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
