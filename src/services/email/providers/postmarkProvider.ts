import { ServerClient } from "postmark";
import type { EmailProvider, EmailRequest, ProviderResponse } from "./types";

export class PostmarkProvider implements EmailProvider {
  private readonly client: ServerClient;

  constructor(apiToken: string) {
    this.client = new ServerClient(apiToken);
  }

  async send(request: EmailRequest): Promise<ProviderResponse> {
    try {
      const response = await this.client.sendEmail({
        From: `${request.fromName} <${request.from}>`,
        To: request.to,
        ReplyTo: request.replyTo,
        Subject: request.subject,
        HtmlBody: request.htmlBody,
        TextBody: request.textBody,
        Tag: request.tags?.[0],
        MessageStream: request.messageStream || "outbound",
        TrackOpens: false,
        Attachments: request.attachments?.map((attachment) => ({
          ...attachment,
          ContentID: attachment.Name
        }))
      });
      return { success: true, providerMessageId: response.MessageID, rawResponse: response };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message, rawResponse: error };
    }
  }

  getProviderName(): string {
    return "postmark";
  }
}
