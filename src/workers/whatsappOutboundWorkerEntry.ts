import "dotenv/config";
import { installProcessShutdownHandlers, registerShutdownHook, runShutdownHooks } from "../lib/shutdownRegistry";
import { logger } from "../lib/logger";
import { whatsappOutboundQueue } from "../queues/whatsappOutboundQueue";
import { closeWhatsAppOutboundWorker, startWhatsAppOutboundWorker } from "./whatsappOutboundWorker";

const worker = startWhatsAppOutboundWorker();
if (!worker) {
  logger.error("WhatsApp outbound worker requires REDIS_URL (non-localhost).");
  process.exit(1);
}

registerShutdownHook(async () => closeWhatsAppOutboundWorker(worker));
const woq = whatsappOutboundQueue;
if (woq) registerShutdownHook(() => woq.close());
installProcessShutdownHandlers(async () => {
  await runShutdownHooks();
});

logger.info("Standalone WhatsApp outbound worker process running.");
