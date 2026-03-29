import { prisma } from "../lib/prisma";
import { decrypt } from "../lib/encryption";
import { sendWhatsApp } from "./whatsappSender";
import { addToHistory, getConversationHistory, isProcessed, markProcessed } from "./dmDedup";
import { generateDmReply } from "./dmReplyAgent";
import { sendInstagramDm } from "./instagramSender";

function metaRecipientIds(recipientId: string): string[] {
  const id = String(recipientId).trim();
  if (!id) return [];
  return Array.from(new Set([id]));
}

export async function processIncomingDm(body: unknown): Promise<void> {
  if (!body || typeof body !== "object") return;
  const root = body as Record<string, unknown>;
  const object = root.object;
  if (object !== "instagram" && object !== "page") return;

  const entries = Array.isArray(root.entry) ? root.entry : [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const ent = entry as Record<string, unknown>;
    const messaging = Array.isArray(ent.messaging) ? ent.messaging : [];
    for (const evt of messaging) {
      await handleMessagingEvent(evt);
    }
  }
}

async function handleMessagingEvent(evt: unknown): Promise<void> {
  if (!evt || typeof evt !== "object") return;
  const e = evt as Record<string, unknown>;

  const sender = e.sender && typeof e.sender === "object" ? (e.sender as Record<string, unknown>) : null;
  const recipient =
    e.recipient && typeof e.recipient === "object" ? (e.recipient as Record<string, unknown>) : null;
  const message = e.message && typeof e.message === "object" ? (e.message as Record<string, unknown>) : null;

  const senderId = typeof sender?.id === "string" ? sender.id : "";
  const recipientId = typeof recipient?.id === "string" ? recipient.id : "";

  if (!senderId || !recipientId || !message) return;

  if (message.is_echo === true) return;

  const messageId =
    typeof message.mid === "string"
      ? message.mid
      : typeof message.message_id === "string"
        ? message.message_id
        : "";
  if (!messageId) return;

  const messageText =
    typeof message.text === "string"
      ? message.text
      : typeof message.quick_reply === "object" && message.quick_reply !== null
        ? String((message.quick_reply as Record<string, unknown>).payload ?? "")
        : "";
  if (!messageText.trim()) return;

  if (await isProcessed(messageId)) return;
  await markProcessed(messageId);

  const recipientIds = metaRecipientIds(recipientId);
  const socialAccount = await prisma.socialAccount.findFirst({
    where: {
      platform: "INSTAGRAM",
      OR: [{ pageId: { in: recipientIds } }, { platformUserId: { in: recipientIds } }]
    },
    include: {
      client: true
    }
  });

  if (!socialAccount) {
    console.log("[processInstagramDm] No INSTAGRAM SocialAccount for recipient", recipientId);
    return;
  }

  const { client } = socialAccount;
  if (!client.dmAutoReplyEnabled) {
    console.log("[processInstagramDm] dmAutoReplyEnabled=false for client", client.id);
    return;
  }

  let pageToken: string;
  try {
    pageToken = decrypt(socialAccount.encryptedToken);
  } catch (err) {
    console.log("[processInstagramDm] token decrypt failed", err instanceof Error ? err.message : String(err));
    return;
  }

  const conversation = await prisma.dmConversation.upsert({
    where: {
      clientId_instagramUserId: { clientId: client.id, instagramUserId: senderId }
    },
    create: {
      clientId: client.id,
      instagramUserId: senderId,
      senderName: null,
      status: "active"
    },
    update: {}
  });

  const history = await getConversationHistory(senderId, client.id);

  const ai = await generateDmReply(
    messageText.trim(),
    history,
    client.dmBusinessContext ?? "",
    client.dmOwnerTone ?? "",
    client.name
  );

  if (ai.captureAsLead && !conversation.leadCaptured) {
    const sourceId = senderId;
    const contactName =
      ai.leadNote.trim().slice(0, 200) || `Instagram DM (${senderId.slice(0, 12)}…)`;
    try {
      const lead = await prisma.lead.upsert({
        where: {
          clientId_source_sourceId: {
            clientId: client.id,
            source: "instagram_dm",
            sourceId
          }
        },
        create: {
          clientId: client.id,
          source: "instagram_dm",
          sourceId,
          contactName
        },
        update: {
          contactName
        }
      });
      await prisma.dmConversation.update({
        where: { id: conversation.id },
        data: { leadCaptured: true, leadId: lead.id }
      });
    } catch (err) {
      console.log("[processInstagramDm] lead upsert failed", err instanceof Error ? err.message : String(err));
    }
  }

  if (ai.confidence >= 0.6 && ai.reply.trim()) {
    const sent = await sendInstagramDm(senderId, ai.reply.trim(), pageToken);
    if (sent) {
      await prisma.dmMessage.create({
        data: {
          conversationId: conversation.id,
          direction: "outbound",
          content: ai.reply.trim(),
          sentByAi: true,
          confidence: ai.confidence,
          intentLabel: ai.intent
        }
      });
      await addToHistory(senderId, client.id, "bot", ai.reply.trim());
    }
  } else {
    const ownerPhone = client.whatsappNumber?.trim();
    if (ownerPhone) {
      const alert =
        `New IG DM from user ${senderId}: "${messageText.slice(0, 280)}${messageText.length > 280 ? "…" : ""}"\n` +
        `AI was unsure how to reply. Please respond manually.`;
      await sendWhatsApp(ownerPhone, alert);
    } else {
      console.log("[processInstagramDm] Low confidence / empty reply; no client.whatsappNumber for alert");
    }
    await prisma.dmConversation.update({
      where: { id: conversation.id },
      data: { status: "escalated" }
    });
  }

  await prisma.dmMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "inbound",
      content: messageText.trim(),
      sentByAi: false,
      confidence: ai.confidence,
      intentLabel: ai.intent
    }
  });
  await addToHistory(senderId, client.id, "user", messageText.trim());
}
