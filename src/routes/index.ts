import { Router } from "express";
import { aiRouter } from "./ai";
import { auditLogsRouter } from "./auditLogs";
import { authRouter } from "./auth";
import { billingRouter } from "./billing";
import { clientsRouter } from "./clients";
import { healthRouter } from "./health";
import { leadsRouter } from "./leads";
import { postsRouter } from "./posts";
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
apiRouter.use("/posts", postsRouter);
apiRouter.use("/audit-logs", auditLogsRouter);
apiRouter.use("/social-accounts", socialAccountsRouter);
apiRouter.use("/webhooks", webhookRouter);
