import { randomUUID } from "node:crypto";
import { SendRawEmailCommand, SESClient } from "@aws-sdk/client-ses";
import type { EmailProvider, EmailRequest, ProviderResponse } from "./types";

function encodeBase64Utf8(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function buildRawEmail(request: EmailRequest): Uint8Array {
  const boundary = `NextPart_${randomUUID()}`;
  const lines: string[] = [
    `From: ${request.fromName} <${request.from}>`,
    `To: ${request.to}`,
    `Subject: =?UTF-8?B?${encodeBase64Utf8(request.subject)}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary=\"${boundary}\"`
  ];

  if (request.replyTo) {
    lines.splice(2, 0, `Reply-To: ${request.replyTo}`);
  }

  lines.push(
    "",
    `--${boundary}`,
    "Content-Type: multipart/alternative; boundary=ALT_BOUNDARY",
    "",
    "--ALT_BOUNDARY",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeBase64Utf8(request.textBody),
    "",
    "--ALT_BOUNDARY",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeBase64Utf8(request.htmlBody),
    "",
    "--ALT_BOUNDARY--"
  );

  for (const attachment of request.attachments ?? []) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${attachment.ContentType}; name=\"${attachment.Name}\"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename=\"${attachment.Name}\"`,
      "",
      attachment.Content,
      ""
    );
  }

  lines.push(`--${boundary}--`, "");
  return Buffer.from(lines.join("\r\n"), "utf8");
}

export class SesProvider implements EmailProvider {
  private readonly client: SESClient;

  constructor(accessKeyId: string, secretAccessKey: string, region: string) {
    this.client = new SESClient({
      region,
      credentials: { accessKeyId, secretAccessKey }
    });
  }

  async send(request: EmailRequest): Promise<ProviderResponse> {
    try {
      const command = new SendRawEmailCommand({
        RawMessage: {
          Data: buildRawEmail(request)
        }
      });
      const response = await this.client.send(command);
      return { success: true, providerMessageId: response.MessageId, rawResponse: response };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message, rawResponse: error };
    }
  }

  getProviderName(): string {
    return "ses";
  }
}
