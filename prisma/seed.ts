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
import { encrypt } from "../src/lib/encryption";
import { prisma } from "../src/lib/prisma";

const SEED_BCRYPT_ROUNDS = 10;

/** Arома Silk House — saree & ethnic wear, Bhubaneswar. Bilingual Hindi–English, ~4.2% ER in analytics. */
const aromaSilkCaptions = [
  "New Kanjeevaram drop — deep maroon with gold zari. Limited pieces. DM “SAREE” / नई कांजीवरम कलेक्शन — डीएम करें। #Bhubaneswar #SareeLove",
  "Behind the scenes: pleating a bridal drape for tomorrow’s wedding. Book styling consult — ब्राइडल ड्रेपिंग स्लॉट खुले हैं।",
  "Festive offer: 10% off handloom dupatta sets this week — ओडिशा हैंडलूम | Visit us Patia / online link in bio.",
  "Reel: 30-second guide — how to store silk sarees in humid weather. Save for later! मानसून में सिल्क की देखभाल।",
  "Odisha ikat meets contemporary blouse cuts — new lookbook live. Tag a friend who loves ethnic wear.",
  "Saturday trunk show — Bengal cottons + Tussar. Chai on us, 4–8 PM. #EthnicWear #Bhubaneswar",
  "Customer story: “First saree for office — you helped me drape it perfectly.” Thank you, Priya! 🙏",
  "Wedding season ready: pastel palette + temple jewellery pairing tips. Consult: DM or call.",
  "BTS: unpacking fresh shipment from Varanasi weavers — each piece numbered. Preview stories.",
  "Hindi + English captions because our family shops in both — आपकी भाषा, हमारी सेवा।",
  "Lehenga light layer for sangeet — breathable fabrics for Odisha heat. Book trial slot.",
  "Dupatta styling 3 ways — carousel post, swipe for festive → office → casual.",
  "Local boutique collab: limited co-branded stoles — support MSME together. #VocalForLocal",
  "Tonight 7 PM — LIVE: festive colour trends 2026. Set reminder! लाइव में जुड़ें।",
  "Organza saree restock — sheer elegance, full lining options. Shop link in bio.",
  "Mother–daughter matching dupatta sets — Mother’s Day early bird code MOM15.",
  "Alterations desk open Tue–Sat — fall, blouse, pleats. Same-week turnaround when possible.",
  "Designer spotlight: hand-embroidered motifs inspired by Konark. Art you can wear.",
  "Poll: Which drape for office — belted or classic seedha? Comment 1 or 2.",
  "Rain-ready ethnic: quick-dry linings for monsoon weddings. Ask in DM — मानसून शादी के लिए।",
  "Reels: fold a saree for travel in 45 seconds. Save + share with bridesmaids.",
  "New stock alert: Bengal taant in jewel tones — lightweight, office-friendly.",
  "Thank you 4.2k family on Instagram — ग्रोथ आपकी वजह से। Next milestone: styling masterclass.",
  "Corporate ethnic Friday — crisp cotton sarees + stitched blouses. Bulk orders for teams welcome.",
  "Jewellery pairing guide: choker vs long haar with boat neck blouses — carousel up now.",
  "Festive countdown: Diwali edit dropping Friday 6 PM — early access list in stories.",
  "Sustainable care: eco detergent tips for zari maintenance. Read caption — पारंपरिक जरी की देखभाल।",
  "In-store personal shopper slots — 45 min, ₹ redeemable on purchase. Book via DM.",
  "Throwback: our first pop-up at Ekamra Haat — grateful for Odisha’s love. #ThrowbackThursday",
  "Weekend styling hours extended — walk-ins welcome 11–8. See you at Arома Silk House, Patia."
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

/** ~4.2% engagement rate: (likes+comments+shares) / reach for analytics overview. */
const TARGET_ER_AROMA = 0.042;

async function seedPostsFixedEngagement(
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

    const reach = 8200 + (i % 9) * 260;
    const totalEng = Math.max(1, Math.round(reach * TARGET_ER_AROMA));
    const likes = Math.max(0, Math.round(totalEng * 0.64));
    const comments = Math.max(0, Math.round(totalEng * 0.24));
    const shares = Math.max(0, totalEng - likes - comments);
    const impressions = Math.round(reach * 1.22);

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

/** Linear growth ~`weeklyGain` followers per 7 days; day 0 = `currentFollowers`. */
async function seedFollowerLinearGrowth(
  socialAccountId: string,
  currentFollowers: number,
  weeklyGain: number,
  dayCount: number
) {
  await prisma.socialAccount.update({
    where: { id: socialAccountId },
    data: { followerCount: currentFollowers }
  });
  const dailyGain = weeklyGain / 7;
  for (let d = 0; d < dayCount; d += 1) {
    const day = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    day.setUTCHours(0, 0, 0, 0);
    const followerCount = Math.max(0, Math.round(currentFollowers - d * dailyGain));
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
  // Operator logins (docs: README, docs/DEMO.md):
  // Primary: demo@demo.com / Demo1234!
  // Alternates: admin@demo.com / admin123, salon@pilot.demo / pilot123, demo@agencyname.com / Demo1234!
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
      name: "Arома Silk House",
      ownerId: admin.id,
      agencyId: demoAgency.id
    },
    create: {
      id: "demo-client",
      name: "Arома Silk House",
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
      name: "Arома Silk House — store manager (pilot)",
      passwordHash: pilotHash,
      role: "CLIENT_USER",
      clientId: client.id
    },
    create: {
      email: "salon@pilot.demo",
      name: "Arома Silk House — store manager (pilot)",
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
      platformUsername: "aromasilkhouse",
      pageId: "demo-page",
      pageName: "Arома Silk House",
      encryptedToken: encrypt("demo-access-token"),
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastSyncedAt: new Date()
    },
    create: {
      clientId: client.id,
      platform: "INSTAGRAM",
      platformUserId: "demo-ig-user-001",
      platformUsername: "aromasilkhouse",
      pageId: "demo-page",
      pageName: "Arома Silk House",
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

  /** Emphasise 7–9 PM window for demo insight alignment. */
  const preferredHoursAroma = [
    19, 20, 21, 19, 20, 21, 18, 20, 19, 21, 20, 19, 18, 21, 20, 19, 20, 21, 19, 20, 21, 19, 20, 18, 21, 19, 20, 21, 20, 19
  ];
  const preferredHoursCafe = [8, 9, 10, 11, 15, 16, 17, 19];

  await seedPostsFixedEngagement(socialAccount.id, "demo-post", aromaSilkCaptions, preferredHoursAroma);
  await seedPostSeries(socialCafe.id, "cafe-post", cafeCaptions, preferredHoursCafe);

  const cafeBase = randomInt(6200, 9800);

  try {
    await seedFollowerLinearGrowth(socialAccount.id, 4200, 80, 36);
    await seedFollowerCurve(socialCafe.id, cafeBase);
  } catch {
    console.warn("Seed: FollowerDaily skipped — run `npm run prisma:migrate` for follower snapshots.");
  }

  const leadDataAroma = [
    { source: "instagram_dm", sourceId: "aroma-lead-01", contactName: "Riya Sahu — bridal saree consult", status: "NEW" as const },
    {
      source: "instagram_comment",
      sourceId: "aroma-lead-02",
      contactName: "Boutique Kanya — wholesale dupatta enquiry",
      status: "CONTACTED" as const
    },
    {
      source: "instagram_dm",
      sourceId: "aroma-lead-03",
      contactName: "Ankita Mishra — office ethnic Friday (team of 12)",
      status: "NEW" as const
    },
    {
      source: "website",
      sourceId: "aroma-lead-04",
      contactName: "Wedding Planners Odisha — vendor tie-up",
      status: "CONTACTED" as const
    },
    {
      source: "instagram_dm",
      sourceId: "aroma-lead-05",
      contactName: "Debjani Das — Kanjeevaram for reception",
      status: "CONVERTED" as const
    },
    {
      source: "instagram_comment",
      sourceId: "aroma-lead-06",
      contactName: "Local customer — Patia, mother–daughter sets",
      status: "NEW" as const
    },
    {
      source: "instagram_dm",
      sourceId: "aroma-lead-07",
      contactName: "Studio Vastra Kolkata — Bengal cotton bulk",
      status: "NEW" as const
    },
    {
      source: "instagram_dm",
      sourceId: "aroma-lead-08",
      contactName: "Meera Nair — destination wedding styling",
      status: "CONTACTED" as const
    },
    {
      source: "instagram_comment",
      sourceId: "aroma-lead-09",
      contactName: "Individual — first saree for campus interview",
      status: "NEW" as const
    },
    {
      source: "instagram_dm",
      sourceId: "aroma-lead-10",
      contactName: "Cuttack boutique owner — ikat collaboration",
      status: "LOST" as const
    },
    {
      source: "website",
      sourceId: "aroma-lead-11",
      contactName: "Corporate HR — ethnic day bulk order",
      status: "NEW" as const
    },
    {
      source: "instagram_dm",
      sourceId: "aroma-lead-12",
      contactName: "Sneha Tripathy — festive lehenga trial",
      status: "CONTACTED" as const
    },
    {
      source: "instagram_comment",
      sourceId: "aroma-lead-13",
      contactName: "Neha Agarwal — jewellery pairing consult",
      status: "NEW" as const
    },
    {
      source: "instagram_dm",
      sourceId: "aroma-lead-14",
      contactName: "Puri resort events — guest welcome stoles",
      status: "NEW" as const
    },
    {
      source: "instagram_dm",
      sourceId: "aroma-lead-15",
      contactName: "Influencer collab — micro creator @bbsr.style",
      status: "CONTACTED" as const
    }
  ];
  for (const lead of leadDataAroma) {
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

  await prisma.scheduledPost.deleteMany({
    where: { clientId: client.id, socialAccountId: socialAccount.id }
  });
  const scheduledIn3d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  await prisma.scheduledPost.create({
    data: {
      clientId: client.id,
      socialAccountId: socialAccount.id,
      caption:
        "Festive silk drop — Friday 6 PM. Set reminder in stories! ज़री रॉयल ब्लू — limited stock.",
      mediaUrls: ["https://picsum.photos/seed/aroma-sch-1/800/800"],
      hashtags: ["AromaSilkHouse", "Bhubaneswar", "SareeLove"],
      status: "SCHEDULED",
      scheduledAt: scheduledIn3d
    }
  });
  await prisma.scheduledPost.create({
    data: {
      clientId: client.id,
      socialAccountId: socialAccount.id,
      caption: "Draft: Corporate ethnic Friday lookbook — outreach to Odisha IT corridor teams.",
      mediaUrls: [],
      hashtags: [],
      status: "DRAFT",
      scheduledAt: null
    }
  });

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

  await prisma.aiInsight.deleteMany({
    where: { clientId: client.id, platform: "INSTAGRAM" }
  });
  await prisma.aiInsight.create({
    data: {
      clientId: client.id,
      platform: "INSTAGRAM",
      summary:
        "Post during 7–9 PM for roughly 2× reach on your audience — भारतीय समय अनुसार शाम का विंडो सबसे मजबूत दिख रहा है। Women 25–45 in Odisha/Bengal markets respond strongest in this window.",
      recommendations: [
        "Batch Reels and carousel posts between 7–9 PM IST; warm up with stories 6–7 PM.",
        "Pin one evergreen offer post; refresh creative every two weeks — bilingual Hindi–English hooks in the first two lines.",
        "Pair saree showcases with clear CTAs (DM / link) during festive drops for measurable DMs."
      ],
      keyInsights: [
        "Weekly insight: Post during 7–9 PM for 2× reach on your audience.",
        "Evening slots align with higher saves and DMs on ethnic wear and festive posts in seeded analytics.",
        "Mix #Bhubaneswar, #SareeLove, and #EthnicWear for discovery across Odisha and Bengal interest."
      ],
      warning: null
    }
  });

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
    "Seed OK: users upserted (password field = passwordHash, bcrypt cost %s) — primary demo@demo.com / Demo1234!; alternates: demo@agencyname.com, admin@demo.com, salon@pilot.demo",
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
