import "dotenv/config";
import { installProcessShutdownHandlers, registerShutdownHook, runShutdownHooks } from "../lib/shutdownRegistry";
import { logger } from "../lib/logger";
import { closeWhatsAppIngressWorker, startWhatsAppIngressWorker } from "./whatsappIngressWorker";

const worker = startWhatsAppIngressWorker();
if (!worker) {
  logger.error("WhatsApp ingress worker requires REDIS_URL (non-localhost).");
  process.exit(1);
}

registerShutdownHook(async () => closeWhatsAppIngressWorker(worker));
installProcessShutdownHandlers(async () => {
  await runShutdownHooks();
});

logger.info("Standalone WhatsApp ingress worker process running.");
