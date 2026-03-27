import { Router } from "express";
import { aiRouter } from "./ai";
import { authRouter } from "./auth";
import { billingRouter } from "./billing";
import { clientsRouter } from "./clients";
import { healthRouter } from "./health";
import { leadsRouter } from "./leads";
import { socialAccountsRouter } from "./socialAccounts";
import { webhookRouter } from "./webhooks";
import { instagramRouter } from "./instagram";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/instagram", instagramRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/billing", billingRouter);
apiRouter.use("/clients", clientsRouter);
apiRouter.use("/leads", leadsRouter);
apiRouter.use("/social-accounts", socialAccountsRouter);
apiRouter.use("/webhooks", webhookRouter);
