export interface EmailRequest {
  to: string;
  from: string;
  fromName: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  replyTo?: string;
  tags?: string[];
  messageStream?: string;
  attachments?: Array<{ Name: string; Content: string; ContentType: string }>;
}

export interface ProviderResponse {
  success: boolean;
  providerMessageId?: string;
  rawResponse?: unknown;
  error?: string;
}

export interface EmailProvider {
  send(request: EmailRequest): Promise<ProviderResponse>;
  getProviderName(): string;
}
