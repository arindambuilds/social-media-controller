import { Router } from "express";
import { authRouter } from "./auth";
import { clientsRouter } from "./clients";
import { healthRouter } from "./health";
import { socialAccountsRouter } from "./socialAccounts";
import { webhookRouter } from "./webhooks";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/clients", clientsRouter);
apiRouter.use("/social-accounts", socialAccountsRouter);
apiRouter.use("/webhooks", webhookRouter);
