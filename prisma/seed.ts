import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { encrypt } from "../src/lib/encryption";

const prisma = new PrismaClient();

async function main() {
  const demoAgencyHash = await bcrypt.hash("Demo1234!", 12);
  const demoAgency = await prisma.user.upsert({
    where: { email: "demo@agencyname.com" },
    update: {
      name: "Demo Agency (presentations)",
      passwordHash: demoAgencyHash,
      role: "AGENCY_ADMIN"
    },
    create: {
      email: "demo@agencyname.com",
      name: "Demo Agency (presentations)",
      passwordHash: demoAgencyHash,
      role: "AGENCY_ADMIN"
    }
  });

  const passwordHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: { name: "Founder (demo)", passwordHash, role: "AGENCY_ADMIN" },
    create: {
      email: "admin@demo.com",
      name: "Founder (demo)",
      passwordHash,
      role: "AGENCY_ADMIN"
    }
  });

  const client = await prisma.client.upsert({
    where: { id: "demo-client" },
    update: {
      name: "Urban Glow Studio — Bhubaneswar (demo)",
      ownerId: admin.id,
      agencyId: demoAgency.id
    },
    create: {
      id: "demo-client",
      name: "Urban Glow Studio — Bhubaneswar (demo)",
      ownerId: admin.id,
      agencyId: demoAgency.id
    }
  });

  await prisma.user.update({
    where: { id: admin.id },
    data: { clientId: client.id }
  });

  const pilotHash = await bcrypt.hash("pilot123", 12);
  await prisma.user.upsert({
    where: { email: "salon@pilot.demo" },
    update: {
      name: "Urban Glow — manager (pilot)",
      passwordHash: pilotHash,
      role: "CLIENT_USER",
      clientId: client.id
    },
    create: {
      email: "salon@pilot.demo",
      name: "Urban Glow — manager (pilot)",
      passwordHash: pilotHash,
      role: "CLIENT_USER",
      clientId: client.id
    }
  });

  const socialAccount = await prisma.socialAccount.upsert({
    where: {
      platform_platformUserId: {
        platform: "INSTAGRAM",
        platformUserId: "demo-ig-user-001"
      }
    },
    update: {
      clientId: client.id,
      platformUsername: "urbanglow.bbsr",
      pageId: "demo-page",
      pageName: "Urban Glow Studio",
      encryptedToken: encrypt("demo-access-token"),
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastSyncedAt: new Date()
    },
    create: {
      clientId: client.id,
      platform: "INSTAGRAM",
      platformUserId: "demo-ig-user-001",
      platformUsername: "urbanglow.bbsr",
      pageId: "demo-page",
      pageName: "Urban Glow Studio",
      encryptedToken: encrypt("demo-access-token"),
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastSyncedAt: new Date()
    }
  });

  const mockPosts = await prisma.post.findMany({
    where: {
      socialAccountId: socialAccount.id,
      platformPostId: { startsWith: "mock_" }
    },
    select: { id: true }
  });
  const mockPostIds = mockPosts.map((p) => p.id);
  if (mockPostIds.length > 0) {
    await prisma.postMetricDaily.deleteMany({ where: { postId: { in: mockPostIds } } });
    await prisma.postInsight.deleteMany({ where: { postId: { in: mockPostIds } } });
    await prisma.comment.deleteMany({ where: { postId: { in: mockPostIds } } });
    await prisma.post.deleteMany({ where: { id: { in: mockPostIds } } });
  }

  const now = new Date();
  const preferredHours = [18, 19, 20, 21, 14, 13, 12, 11];
  const captions = [
    "Weekend glow-up slots open — Patia + Saheed Nagar. DM “GLOW” to book. #Bhubaneswar #Salon",
    "Bridal hair trials this month — save your date early. Link in bio.",
    "Monsoon hair care bundle — walk-ins welcome near Infocity.",
    "Before / after: soft balayage done in-studio. Book a consult.",
    "Coffee + haircut combo — Sat mornings only. Limited slots.",
    "Festive ready? Skin + hair package — ask for the Odisha bride bundle.",
    "Kids’ cuts available — family-friendly timings 6–8 PM.",
    "New stylist on floor — follow for tips and offers.",
    "Reels: 3-minute frizz fix you can do at home.",
    "Tag a friend who needs a haircut — referral bonus this week.",
    "Behind the scenes: sterilisation and safety every day.",
    "DM us your hair goals — we’ll suggest a realistic plan.",
    "Student discount Tue–Thu with ID — share with college friends.",
    "Men’s grooming + beard trim — same-day slots.",
    "Colour correction consult — book before chemical work.",
    "Threading + brow shaping — add on to any service.",
    "Mother–daughter day — special pricing on Sundays.",
    "Local business love — thank you for 5★ reviews!",
    "Rainy day frizz? We’ve got smoothing treatments in stock.",
    "Last few slots for the long weekend — hurry!"
  ];
  for (let i = 0; i < 20; i += 1) {
    const publishedAt = new Date(now.getTime() - i * 36 * 60 * 60 * 1000);
    const hour = preferredHours[i % preferredHours.length];
    publishedAt.setHours(hour, 30, 0, 0);

    const eveningBoost = hour >= 18 && hour <= 21 ? 1.6 : 1.0;
    const likes = Math.round(randomInt(40, 320) * eveningBoost);
    const comments = Math.round(randomInt(3, 35) * (eveningBoost > 1 ? 1.25 : 1));
    const shares = Math.round(randomInt(1, 20) * (eveningBoost > 1 ? 1.2 : 1));
    const impressions = randomInt(100, 5000);
    const reach = randomInt(80, 4000);

    const caption = captions[i] ?? `Salon update ${i + 1} — Urban Glow Studio, Bhubaneswar.`;

    await prisma.post.upsert({
      where: {
        socialAccountId_platformPostId: {
          socialAccountId: socialAccount.id,
          platformPostId: `demo-post-${i + 1}`
        }
      },
      update: {
        content: caption,
        mediaUrl: `https://picsum.photos/seed/demo-${i + 1}/800/800`,
        publishedAt,
        engagementStats: { likes, comments, shares, impressions, reach }
      },
      create: {
        socialAccountId: socialAccount.id,
        platformPostId: `demo-post-${i + 1}`,
        content: caption,
        mediaUrl: `https://picsum.photos/seed/demo-${i + 1}/800/800`,
        publishedAt,
        engagementStats: { likes, comments, shares, impressions, reach }
      }
    });
  }

  const leadData = [
    { source: "instagram_dm", sourceId: "lead-001", contactName: "Priya (DM — bridal package)", status: "NEW" as const },
    { source: "instagram_comment", sourceId: "lead-002", contactName: "Rahul (comment — haircut)", status: "CONTACTED" as const },
    { source: "instagram_dm", sourceId: "lead-003", contactName: "Ananya (DM — colour consult)", status: "CONVERTED" as const }
  ];
  for (const lead of leadData) {
    await prisma.lead.upsert({
      where: {
        clientId_source_sourceId: {
          clientId: client.id,
          source: lead.source,
          sourceId: lead.sourceId
        }
      },
      update: { contactName: lead.contactName, status: lead.status },
      create: {
        clientId: client.id,
        source: lead.source,
        sourceId: lead.sourceId,
        contactName: lead.contactName,
        status: lead.status
      }
    });
  }

  const existingInsight = await prisma.aiInsight.findFirst({
    where: { clientId: client.id, platform: "INSTAGRAM" }
  });
  if (!existingInsight) {
    await prisma.aiInsight.create({
      data: {
        clientId: client.id,
        platform: "INSTAGRAM",
        summary:
          "Evening posts (roughly 6–9 PM) are earning stronger saves and DMs for Urban Glow. Short hooks with a clear booking CTA outperform longer captions in this sample.",
        recommendations: [
          "Batch 2–3 Reels or photo posts for Tue–Thu evenings when engagement peaks.",
          "Repeat the DM keyword pattern (e.g. “GLOW”) on high-intent posts to make follow-up measurable.",
          "Pin one evergreen offer post and refresh the creative every 2 weeks."
        ],
        keyInsights: [
          "Local + service hashtags (#Bhubaneswar, #Salon) appear on your better-performing posts.",
          "Weekend and festive captions drive more comments — good for social proof.",
          "Consistency beats volume: steady weekly posts beat sporadic bursts."
        ],
        warning: null
      }
    });
  }

  try {
    const baseFollowers = 2100;
    await prisma.socialAccount.update({
      where: { id: socialAccount.id },
      data: { followerCount: baseFollowers + 120 }
    });
    for (let d = 0; d < 35; d += 1) {
      const day = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
      day.setUTCHours(0, 0, 0, 0);
      const followerCount = baseFollowers + (35 - d) * 4 + randomInt(0, 6);
      await prisma.followerDaily.upsert({
        where: {
          socialAccountId_date: {
            socialAccountId: socialAccount.id,
            date: day
          }
        },
        update: { followerCount },
        create: {
          socialAccountId: socialAccount.id,
          date: day,
          followerCount
        }
      });
    }
  } catch {
    console.warn("Seed: FollowerDaily skipped — run `npm run prisma:migrate` for follower snapshots.");
  }

  for (let i = 0; i < 5; i += 1) {
    await prisma.message.upsert({
      where: {
        socialAccountId_platformMessageId: {
          socialAccountId: socialAccount.id,
          platformMessageId: `demo-msg-${i + 1}`
        }
      },
      update: {
        fromId: `user-${i + 1}`,
        fromName: `DemoUser${i + 1}`,
        text: `Hello from demo user ${i + 1}`,
        isLead: i % 2 === 0
      },
      create: {
        socialAccountId: socialAccount.id,
        platformMessageId: `demo-msg-${i + 1}`,
        fromId: `user-${i + 1}`,
        fromName: `DemoUser${i + 1}`,
        text: `Hello from demo user ${i + 1}`,
        isLead: i % 2 === 0
      }
    });
  }
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
