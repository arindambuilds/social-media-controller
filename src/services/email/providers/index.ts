import { emailConfig } from "../../../config/env";
import { PostmarkProvider } from "./postmarkProvider";
import { SesProvider } from "./sesProvider";
import type { EmailProvider } from "./types";

export function createPrimaryProvider(): EmailProvider {
  if (emailConfig.provider === "ses") {
    const { AWS_SES_ACCESS_KEY, AWS_SES_SECRET_KEY, AWS_SES_REGION } = process.env;
    if (!AWS_SES_ACCESS_KEY || !AWS_SES_SECRET_KEY || !AWS_SES_REGION) {
      throw new Error("EMAIL_PROVIDER=ses requires AWS_SES_ACCESS_KEY, AWS_SES_SECRET_KEY, and AWS_SES_REGION.");
    }
    return new SesProvider(AWS_SES_ACCESS_KEY, AWS_SES_SECRET_KEY, AWS_SES_REGION);
  }

  if (!emailConfig.postmarkToken) {
    throw new Error("Missing POSTMARK_API_TOKEN for primary Postmark provider.");
  }
  return new PostmarkProvider(emailConfig.postmarkToken);
}

export function createSecondaryProvider(): EmailProvider | null {
  if (emailConfig.provider !== "postmark") return null;
  const { AWS_SES_ACCESS_KEY, AWS_SES_SECRET_KEY, AWS_SES_REGION } = process.env;
  if (!AWS_SES_ACCESS_KEY || !AWS_SES_SECRET_KEY || !AWS_SES_REGION) return null;
  return new SesProvider(AWS_SES_ACCESS_KEY, AWS_SES_SECRET_KEY, AWS_SES_REGION);
}
