import { Router } from "express";
import { aiRouter } from "./ai";
import { analyticsRouter } from "./analytics";
import { authRouter } from "./auth";
import { clientsRouter } from "./clients";
import { healthRouter } from "./health";
import { socialAccountsRouter } from "./socialAccounts";
import { webhookRouter } from "./webhooks";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/clients", clientsRouter);
apiRouter.use("/social-accounts", socialAccountsRouter);
apiRouter.use("/webhooks", webhookRouter);
