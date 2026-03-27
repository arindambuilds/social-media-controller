import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: "founder@socialcontroller.local" },
    update: {
      name: "Arindam Founder"
    },
    create: {
      email: "founder@socialcontroller.local",
      name: "Arindam Founder",
      role: "AGENCY_ADMIN"
    }
  });

  const client = await prisma.client.upsert({
    where: { id: "cm-client-glownest" },
    update: {
      name: "GlowNest Salon"
    },
    create: {
      id: "cm-client-glownest",
      name: "GlowNest Salon",
      ownerId: owner.id,
      agencyId: owner.id
    }
  });

  const socialAccount = await prisma.socialAccount.upsert({
    where: {
      platform_platformUserId: {
        platform: "INSTAGRAM",
        platformUserId: "ig-glownest-001"
      }
    },
    update: {
      clientId: client.id,
      platformUsername: "glownest_salon",
      pageId: "page-glownest",
      pageName: "GlowNest Salon",
      encryptedToken: "seed-token-placeholder",
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastSyncedAt: new Date()
    },
    create: {
      clientId: client.id,
      platform: "INSTAGRAM",
      platformUserId: "ig-glownest-001",
      platformUsername: "glownest_salon",
      pageId: "page-glownest",
      pageName: "GlowNest Salon",
      encryptedToken: "seed-token-placeholder",
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastSyncedAt: new Date()
    }
  });

  const posts = [
    {
      id: "post-1",
      platformPostId: "ig-post-001",
      content: "Bridal glow package now available. Book your pre-wedding consultation today.",
      mediaUrl: "https://example.com/post-1.jpg",
      publishedAt: new Date("2026-03-20T20:00:00.000Z"),
      likes: 132,
      commentsCount: 19,
      shares: 8,
      saves: 17,
      impressions: 1880,
      reach: 920,
      engagementRate: 0.1913
    },
    {
      id: "post-2",
      platformPostId: "ig-post-002",
      content: "Fresh haircut transformations for the weekend. DM for appointments.",
      mediaUrl: "https://example.com/post-2.jpg",
      publishedAt: new Date("2026-03-18T14:00:00.000Z"),
      likes: 88,
      commentsCount: 7,
      shares: 2,
      saves: 4,
      impressions: 1210,
      reach: 760,
      engagementRate: 0.1329
    },
    {
      id: "post-3",
      platformPostId: "ig-post-003",
      content: "Client testimonial: the bridal team made my day effortless and elegant.",
      mediaUrl: "https://example.com/post-3.jpg",
      publishedAt: new Date("2026-03-16T19:30:00.000Z"),
      likes: 171,
      commentsCount: 22,
      shares: 11,
      saves: 28,
      impressions: 2210,
      reach: 1080,
      engagementRate: 0.2148
    }
  ];

  for (const post of posts) {
    await prisma.post.upsert({
      where: {
        socialAccountId_platformPostId: {
          socialAccountId: socialAccount.id,
          platformPostId: post.platformPostId
        }
      },
      update: {
        content: post.content,
        mediaUrl: post.mediaUrl,
        publishedAt: post.publishedAt
      },
      create: {
        id: post.id,
        socialAccountId: socialAccount.id,
        platformPostId: post.platformPostId,
        content: post.content,
        mediaUrl: post.mediaUrl,
        publishedAt: post.publishedAt
      }
    });

    const dbPost = await prisma.post.findUniqueOrThrow({
      where: { id: post.id }
    });

    await prisma.postMetricDaily.upsert({
      where: {
        postId_date: {
          postId: dbPost.id,
          date: new Date("2026-03-27T00:00:00.000Z")
        }
      },
      update: {
        likes: post.likes,
        commentsCount: post.commentsCount,
        shares: post.shares,
        saves: post.saves,
        impressions: post.impressions,
        reach: post.reach,
        engagementRate: post.engagementRate
      },
      create: {
        postId: dbPost.id,
        date: new Date("2026-03-27T00:00:00.000Z"),
        likes: post.likes,
        commentsCount: post.commentsCount,
        shares: post.shares,
        saves: post.saves,
        impressions: post.impressions,
        reach: post.reach,
        engagementRate: post.engagementRate
      }
    });
  }

  await prisma.aiInsight.create({
    data: {
      clientId: client.id,
      type: "CONTENT_PERFORMANCE",
      title: "Seed insight",
      summary: "Night-time bridal content is outperforming daytime haircut promotions.",
      payload: {
        topHour: 20,
        bestCaptionBucket: "medium"
      }
    }
  });

  await prisma.recommendation.create({
    data: {
      clientId: client.id,
      category: "WEEKLY_GROWTH",
      priority: 1,
      text: "Post 2 bridal reels between 7 PM and 9 PM this week and use clear booking CTAs.",
      sourceData: {
        driver: "nighttime engagement"
      }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
