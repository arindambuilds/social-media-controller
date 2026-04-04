import { startEmailWorker } from "../services/email/emailWorker";
import { logger } from "../lib/logger";

startEmailWorker();
logger.info("[emailWorkerEntry] Running");

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
