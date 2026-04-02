/**
 * Alias for WhatsApp outbound queue (BullMQ + shared Redis).
 * Prefer importing from here in new code; worker remains `whatsapp-send`.
 */
export { whatsappSendQueue as whatsappQueue } from "./whatsappSendQueue";
export type { WhatsAppSendBriefJob as WhatsAppQueueJobPayload } from "./whatsappSendQueue";
