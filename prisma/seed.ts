/**
 * INVESTIGATION (Steps 1–4)
 *
 * Step 1 — prisma/schema.prisma `User`: hashed password field is `passwordHash` (not `password`).
 *   Email: `email`. No @@map/@map on User → PostgreSQL columns match names, e.g. "passwordHash".
 *   `id`: String @id @default(cuid()). `email` required on create; `role` defaults AGENCY_ADMIN.
 *
 * Step 2 — Login: src/routes/auth.ts → authService.login → findUnique by email, select passwordHash,
 *   bcrypt.compare (package `bcrypt`).
 *
 * Step 3 — Seed upserts demo@demo.com with passwordHash; failures in prod were DB/migrations/connectivity
 *   or ad-hoc SQL using column "password" (does not exist).
 *
 * Step 4 — package.json: `bcrypt` and `bcryptjs` present; app + this seed use `bcrypt` only. Seed uses cost 10.
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { encrypt } from "../src/lib/encryption";

const prisma = new PrismaClient();
const SEED_BCRYPT_ROUNDS = 10;

const urbanCaptions = [
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
  "Last few slots for the long weekend — hurry!",
  "Tuesday colour day — 15% off single-process with any cut.",
  "Walk-in blowouts until 4 PM — beat the humidity.",
  "Reels: 60-second scalp massage routine clients love.",
  "Partner spotlight: our nail tech’s minimal nail art drop.",
  "Early bird Tue–Fri: 10% off services before 11 AM.",
  "Gift cards for Mother’s Day — DM “GIFT”.",
  "Patch test reminder for new colour clients — safety first.",
  "Salon playlist drop — comment your request for next week.",
  "Staff pick: gloss treatment for shine without heavy lift.",
  "Community board: local makers we love — tag your favourite shop."
];

const cafeCaptions = [
  "Single-origin pour-over this week — Ethiopia Yirgacheffe. Ask the barista.",
  "Breakfast combo: oat flat white + sourdough until 11 AM.",
  "Rainy day deal — second pastry half price with any drink.",
  "New seasonal syrup: toasted coconut (limited run).",
  "Plant-based milk rotation: oat, soy, coconut — no extra charge Tue.",
  "Behind the bar: how we dial in espresso every morning.",
  "Tag your study buddy — window seats open after 3 PM.",
  "Cold brew batch #12 is fruit-forward — taste before it’s gone.",
  "Latte art throwdown this Saturday — follow for times.",
  "Dog-friendly patio — water bowls and treats on us.",
  "Reels: 30-second iced mocha hack (less sugar, same joy).",
  "Thank you for 2k local followers — free upsize Fri only.",
  "Matcha whisking demo — Sun 10 AM, first 10 guests.",
  "New pastry: cardamom bun from our neighbour bakery.",
  "Book the back room for small meetings — Wi‑Fi + quiet hours.",
  "Student code STUDY10 — weekdays 2–5 PM.",
  "Zero-waste goal: bring your cup, save ₹10.",
  "Playlist swap: comment a song for tomorrow’s morning mix.",
  "Iced hojicha is back — smoky, less caffeine, all comfort.",
  "Weekend special: affogato with house-made vanilla.",
  "Local art wall refresh — meet the painter this Thu 5 PM.",
  "Brew class waitlist open — DM “BREW”.",
  "Oat cortado + almond croissant = chef’s kiss.",
  "Monsoon hours: we open 30 min early on storm alerts.",
  "Chai concentrate restocked — spicy batch, limited jars.",
  "Kids’ hot chocolate with micro marshmallows — ask at the bar.",
  "Cupping notes: milk chocolate, red apple, clean finish.",
  "Late-night study Thu: open till 11 PM with soft lights.",
  "Community shelf: leave a book, take a book.",
  "Thank the team — tip jars fund barista competition travel."
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function hashSeedPassword(plain: string) {
  return bcrypt.hash(plain, SEED_BCRYPT_ROUNDS);
}

async function seedPostSeries(
  socialAccountId: string,
  platformPostIdPrefix: string,
  captions: string[],
  preferredHours: number[]
) {
  const now = new Date();
  for (let i = 0; i < captions.length; i += 1) {
    const publishedAt = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const hour = preferredHours[i % preferredHours.length];
    publishedAt.setHours(hour, 30, 0, 0);

    const reach = randomInt(5000, 15000);
    const erBps = randomInt(200, 500);
    const totalEng = Math.max(1, Math.round((reach * erBps) / 10000));
    const likes = Math.max(0, Math.round(totalEng * 0.65));
    const comments = Math.max(0, Math.round(totalEng * 0.22));
    const shares = Math.max(0, totalEng - likes - comments);
    const impressions = Math.round(reach * (randomInt(110, 140) / 100));

    const caption = captions[i] ?? `Update ${i + 1}`;

    await prisma.post.upsert({
      where: {
        socialAccountId_platformPostId: {
          socialAccountId,
          platformPostId: `${platformPostIdPrefix}-${i + 1}`
        }
      },
      update: {
        content: caption,
        mediaUrl: `https://picsum.photos/seed/${platformPostIdPrefix}-${i + 1}/800/800`,
        publishedAt,
        engagementStats: { likes, comments, shares, impressions, reach }
      },
      create: {
        socialAccountId,
        platformPostId: `${platformPostIdPrefix}-${i + 1}`,
        content: caption,
        mediaUrl: `https://picsum.photos/seed/${platformPostIdPrefix}-${i + 1}/800/800`,
        publishedAt,
        engagementStats: { likes, comments, shares, impressions, reach }
      }
    });
  }
}

async function seedFollowerCurve(socialAccountId: string, baseFollowers: number) {
  await prisma.socialAccount.update({
    where: { id: socialAccountId },
    data: { followerCount: baseFollowers + randomInt(0, 120) }
  });
  for (let d = 0; d < 35; d += 1) {
    const day = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    day.setUTCHours(0, 0, 0, 0);
    const followerCount = baseFollowers + (35 - d) * randomInt(3, 9) + randomInt(0, 20);
    await prisma.followerDaily.upsert({
      where: {
        socialAccountId_date: {
          socialAccountId,
          date: day
        }
      },
      update: { followerCount },
      create: {
        socialAccountId,
        date: day,
        followerCount
      }
    });
  }
}

async function main() {
  const demoAgencyHash = await hashSeedPassword("Demo1234!");
  const demoAgency = await prisma.user.upsert({
    where: { email: "demo@agencyname.com" },
    update: {
      name: "Growth Agency",
      passwordHash: demoAgencyHash,
      role: "AGENCY_ADMIN"
    },
    create: {
      email: "demo@agencyname.com",
      name: "Growth Agency",
      passwordHash: demoAgencyHash,
      role: "AGENCY_ADMIN"
    }
  });

  const passwordHash = await hashSeedPassword("admin123");
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
      name: "Urban Glow Studio",
      ownerId: admin.id,
      agencyId: demoAgency.id
    },
    create: {
      id: "demo-client",
      name: "Urban Glow Studio",
      ownerId: admin.id,
      agencyId: demoAgency.id
    }
  });

  const clientCafe = await prisma.client.upsert({
    where: { id: "client-cafe" },
    update: {
      name: "Coastal Cafe Co",
      ownerId: admin.id,
      agencyId: demoAgency.id
    },
    create: {
      id: "client-cafe",
      name: "Coastal Cafe Co",
      ownerId: admin.id,
      agencyId: demoAgency.id
    }
  });

  await prisma.user.update({
    where: { id: admin.id },
    data: { clientId: client.id }
  });

  const demoLoginHash = await hashSeedPassword("Demo1234!");
  const demoLoginUser = await prisma.user.upsert({
    where: { email: "demo@demo.com" },
    update: {
      name: "Demo User",
      passwordHash: demoLoginHash,
      role: "AGENCY_ADMIN",
      clientId: client.id
    },
    create: {
      email: "demo@demo.com",
      name: "Demo User",
      passwordHash: demoLoginHash,
      role: "AGENCY_ADMIN",
      clientId: client.id
    }
  });
  console.log(`[seed] Demo user ready: ${demoLoginUser.email} (${demoLoginUser.id})`);

  const pilotHash = await hashSeedPassword("pilot123");
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
      platformUsername: "urbanglow.studio",
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
      platformUsername: "urbanglow.studio",
      pageId: "demo-page",
      pageName: "Urban Glow Studio",
      encryptedToken: encrypt("demo-access-token"),
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastSyncedAt: new Date()
    }
  });

  const socialCafe = await prisma.socialAccount.upsert({
    where: {
      platform_platformUserId: {
        platform: "INSTAGRAM",
        platformUserId: "cafe-ig-user-001"
      }
    },
    update: {
      clientId: clientCafe.id,
      platformUsername: "coastal.cafe.bbsr",
      pageId: "cafe-page",
      pageName: "Coastal Cafe Co",
      encryptedToken: encrypt("demo-cafe-token"),
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastSyncedAt: new Date()
    },
    create: {
      clientId: clientCafe.id,
      platform: "INSTAGRAM",
      platformUserId: "cafe-ig-user-001",
      platformUsername: "coastal.cafe.bbsr",
      pageId: "cafe-page",
      pageName: "Coastal Cafe Co",
      encryptedToken: encrypt("demo-cafe-token"),
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastSyncedAt: new Date()
    }
  });

  const mockPosts = await prisma.post.findMany({
    where: {
      OR: [
        { socialAccountId: socialAccount.id, platformPostId: { startsWith: "mock_" } },
        { socialAccountId: socialCafe.id, platformPostId: { startsWith: "mock_" } }
      ]
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

  const preferredHoursUrban = [18, 19, 20, 21, 14, 13, 12, 11];
  const preferredHoursCafe = [8, 9, 10, 11, 15, 16, 17, 19];

  await seedPostSeries(socialAccount.id, "demo-post", urbanCaptions, preferredHoursUrban);
  await seedPostSeries(socialCafe.id, "cafe-post", cafeCaptions, preferredHoursCafe);

  const urbanBase = randomInt(9200, 11200);
  const cafeBase = randomInt(6200, 9800);

  try {
    await seedFollowerCurve(socialAccount.id, urbanBase);
    await seedFollowerCurve(socialCafe.id, cafeBase);
  } catch {
    console.warn("Seed: FollowerDaily skipped — run `npm run prisma:migrate` for follower snapshots.");
  }

  const leadDataUrban = [
    { source: "instagram_dm", sourceId: "lead-001", contactName: "Priya (DM — bridal package)", status: "NEW" as const },
    { source: "instagram_comment", sourceId: "lead-002", contactName: "Rahul (comment — haircut)", status: "CONTACTED" as const },
    { source: "instagram_dm", sourceId: "lead-003", contactName: "Ananya (DM — colour consult)", status: "CONVERTED" as const }
  ];
  for (const lead of leadDataUrban) {
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

  const leadDataCafe = [
    { source: "instagram_dm", sourceId: "cafe-lead-01", contactName: "Meera — office catering", status: "NEW" as const },
    { source: "instagram_comment", sourceId: "cafe-lead-02", contactName: "Vikram — birthday brunch", status: "CONTACTED" as const },
    { source: "instagram_dm", sourceId: "cafe-lead-03", contactName: "Sneha — workshop space", status: "NEW" as const }
  ];
  for (const lead of leadDataCafe) {
    await prisma.lead.upsert({
      where: {
        clientId_source_sourceId: {
          clientId: clientCafe.id,
          source: lead.source,
          sourceId: lead.sourceId
        }
      },
      update: { contactName: lead.contactName, status: lead.status },
      create: {
        clientId: clientCafe.id,
        source: lead.source,
        sourceId: lead.sourceId,
        contactName: lead.contactName,
        status: lead.status
      }
    });
  }

  const existingInsightUrban = await prisma.aiInsight.findFirst({
    where: { clientId: client.id, platform: "INSTAGRAM" }
  });
  if (!existingInsightUrban) {
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

  const existingInsightCafe = await prisma.aiInsight.findFirst({
    where: { clientId: clientCafe.id, platform: "INSTAGRAM" }
  });
  if (!existingInsightCafe) {
    await prisma.aiInsight.create({
      data: {
        clientId: clientCafe.id,
        platform: "INSTAGRAM",
        summary:
          "Morning and mid-afternoon posts for Coastal Cafe Co get the most saves and DMs. Short hooks about seasonal drinks and limited pastries outperform generic “open now” posts.",
        recommendations: [
          "Post 2–3 morning stories with today’s pastry case and a one-line CTA (e.g. “First 10 get upsize”).",
          "Batch Reels on pour-over and latte art — tag the neighbourhood for discovery.",
          "Pin a post that explains parking + Wi‑Fi for students; refresh the creative monthly."
        ],
        keyInsights: [
          "Engagement clusters around 8–11 AM and 3–5 PM in the seeded sample.",
          "Offer-led captions (student code, rainy day deal) drive more comments than aesthetic-only shots.",
          "Consistent handle @coastal.cafe.bbsr in captions improves branded search."
        ],
        warning: null
      }
    });
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

  console.log(
    "Seed OK: users upserted (password field = passwordHash, bcrypt cost %s) — demo@demo.com / Demo1234!, demo@agencyname.com, admin@demo.com, salon@pilot.demo",
    SEED_BCRYPT_ROUNDS
  );
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
