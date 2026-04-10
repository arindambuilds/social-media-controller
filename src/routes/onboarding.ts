import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { cleanDemoDataForUser } from "../lib/demo-cleaner";
import { seedDemoDataForUser } from "../lib/demo-seeder";

export const onboardingRouter = Router();

const step1Schema = z.object({
  businessName: z.string().min(1),
  businessType: z.string().min(1),
});

onboardingRouter.post("/step1", authenticate, async (req, res) => {
  try {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: { code: "NO_SESSION", message: "Not authenticated." } });
      return;
    }

    const { businessName, businessType } = step1Schema.parse(req.body);
    const userId = req.auth.userId;

    await prisma.user.update({
      where: { id: userId },
      data: { businessName, businessType },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: "Invalid request" });
  }
});

onboardingRouter.post("/step2", authenticate, async (req, res) => {
  try {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: { code: "NO_SESSION", message: "Not authenticated." } });
      return;
    }

    const userId = req.auth.userId;

    await seedDemoDataForUser(userId);

    await prisma.user.update({
      where: { id: userId },
      data: { onboardingStep: 2 },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to seed demo data" });
  }
});

onboardingRouter.post("/complete", authenticate, async (req, res) => {
  try {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: { code: "NO_SESSION", message: "Not authenticated." } });
      return;
    }

    const userId = req.auth.userId;

    await prisma.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to complete onboarding" });
  }
});

onboardingRouter.post("/clean-demo", authenticate, async (req, res) => {
  try {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: { code: "NO_SESSION", message: "Not authenticated." } });
      return;
    }

    const userId = req.auth.userId;

    await cleanDemoDataForUser(userId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to clean demo data" });
  }
});