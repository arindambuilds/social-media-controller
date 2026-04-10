# 📱 SECTION 2 — WHATSAPP INTEGRATION COMPLETE GUIDE

This document provides step-by-step instructions for connecting your app to the real WhatsApp Business API.

---

## ✅ CURRENT STATUS

### What Already Exists:
✅ Webhook endpoint (`src/whatsapp/webhook.router.ts`)  
✅ HMAC signature verification (`src/whatsapp/hmac.middleware.ts`)  
✅ Message normalization (`src/whatsapp/normaliser.ts`)  
✅ Cloud API sender (`src/services/whatsappCloudApiSender.ts`)  
✅ Queue-based message handling (`src/queues/whatsappOutboundQueue.ts`)  
✅ Session management (`src/whatsapp/session.store.ts`)  
✅ Rate limiting (`src/whatsapp/rate-limiter.ts`)  

### What's Missing:
❌ Real Meta Developer App setup  
❌ Permanent access token  
❌ Phone Number ID and Business Account ID  
❌ Webhook verification (GET endpoint)  
❌ Proper error handling for all WhatsApp API error codes  

---

## 🔧 2.1 — WHATSAPP BUSINESS API SETUP

### Manual Steps (Meta Developer Portal):

#### STEP 1: Create Meta Developer App

1. **Go to https://developers.facebook.com**
2. Click "My Apps" (top right)
3. Click "Create App"
4. Select "Business" as app type → Click "Next"
5. Fill in details:
   - **Display name**: `[Your App Name] WhatsApp Bot`
   - **App contact email**: Your email
   - **Business Portfolio**: Select your business or create one
6. Click "Create App"
7. **IMPORTANT**: Save your **App ID** and **App Secret**

#### STEP 2: Add WhatsApp Product

1. In your app dashboard, find "WhatsApp" in the product list
2. Click "Set up"
3. Select your **Business Portfolio** (or create one)
4. Click "Continue"

#### STEP 3: Get Temporary Test Number (Optional)

Meta provides a test number with limited messaging:
- Click "Send and receive messages" section
- You'll see a test phone number (e.g., `+1 555 025 3483`)
- **DO NOT USE THIS IN PRODUCTION** - only for testing

#### STEP 4: Add Your Own Phone Number

1. In WhatsApp dashboard, click "Get started"
2. Click "Add phone number"
3. Select "Use your own phone number"
4. Choose your country code and enter number
5. **Verification Method**: Choose SMS or Voice Call
6. Enter the 6-digit code you receive
7. Click "Verify"
8. **Set Display Name**: This is what users see in WhatsApp
9. Click "Next"

#### STEP 5: Get Phone Number ID

1. After adding your number, go to "API Setup" section
2. You'll see:
   - **Phone Number ID**: (long numeric ID like `123456789012345`)
   - **WhatsApp Business Account ID**: (another long numeric ID)
3. **Copy both** - you'll need them for environment variables

#### STEP 6: Generate Permanent Access Token

1. Go to "API Setup" in WhatsApp dashboard
2. Under "Temporary access token", you'll see a token (expires in 24 hours)
3. To get a **permanent token**:
   - Click "System Users" in left sidebar (or go to Business Settings)
   - Go to your Business Portfolio → System Users
   - Click "Add" to create a system user
   - Name it: `whatsapp-api-user`
   - Role: **Admin**
   - Click "Create System User"
   - Click "Add Assets" → Select "Apps"
   - Find your app and toggle **Full Control**
   - Click "Save Changes"
   - Click "Generate New Token"
   - Select your app
   - Select permissions:
     - ✅ `whatsapp_business_messaging`
     - ✅ `whatsapp_business_management`
   - Click "Generate Token"
   - **COPY THE TOKEN IMMEDIATELY** (you won't see it again!)

#### STEP 7: Configure Webhook URL

**Before you can register the webhook, you need to add a verification endpoint (see Section 2.2 below).**

Once the endpoint is ready:

1. In WhatsApp dashboard → "Configuration"
2. Click "Edit" next to Callback URL
3. Enter your webhook URL:
   ```
   https://your-app.onrender.com/whatsapp/webhook
   ```
4. Enter your **Verify Token** (any random string you create)
   - Generate one: `openssl rand -base64 32`
   - Save this to environment variable `WEBHOOK_VERIFY_TOKEN`
5. Click "Verify and Save"
6. Meta will send a GET request to verify your endpoint
7. If successful, you'll see "Success" ✅

#### STEP 8: Subscribe to Webhook Fields

1. After webhook is verified, scroll to "Webhook fields"
2. Subscribe to:
   - ✅ `messages` (incoming messages)
   - ✅ `message_status` (delivery, read receipts)
   - ✅ `message_echoes` (optional - messages sent by you)
3. Click "Save"

#### STEP 9: Update Environment Variables

Add these to your Render environment:

```bash
# Meta WhatsApp Cloud API
WA_PHONE_NUMBER_ID=123456789012345          # From Step 5
WA_BUSINESS_ACCOUNT_ID=987654321098765      # From Step 5
WA_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxx         # Permanent token from Step 6
WA_APP_SECRET=your_app_secret               # From Step 1
WEBHOOK_VERIFY_TOKEN=your_random_token      # From Step 7

# Webhook settings
WA_WEBHOOK_MSG_DEDUPE_TTL_SEC=300           # 5 minutes (prevents duplicate processing)
```

#### STEP 10: Test Connection

```bash
# Test sending a message via Cloud API
curl -X POST "https://graph.facebook.com/v19.0/YOUR_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "YOUR_TEST_NUMBER",
    "type": "text",
    "text": {
      "body": "Hello from your production app!"
    }
  }'
```

If successful, you'll receive the message on WhatsApp!

---

## ✅ 2.2 — WEBHOOK CONFIGURATION

### Add GET Verification Endpoint

Meta requires a GET endpoint for webhook verification. Currently your app only handles POST.

**File:** `src/whatsapp/webhook.router.ts`

Add this BEFORE the POST handler:

```typescript
// Add at the top of the file
import { env } from "../config/env";

// Add this route BEFORE the POST handler (line 20)
waWebhookRouter.get("/", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // Verify the webhook
  if (mode === "subscribe" && token === env.WEBHOOK_VERIFY_TOKEN) {
    logger.info("[whatsapp webhook] Verification successful");
    res.status(200).send(challenge);
  } else {
    logger.warn("[whatsapp webhook] Verification failed", {
      mode,
      tokenMatch: token === env.WEBHOOK_VERIFY_TOKEN
    });
    res.status(403).send("Forbidden");
  }
});
```

### Update Environment Config

**File:** `src/config/env.ts`

Ensure `WEBHOOK_VERIFY_TOKEN` is defined:

```typescript
export const envSchema = z.object({
  // ... existing fields ...
  WEBHOOK_VERIFY_TOKEN: z.string().min(1).default(""),
  WA_PHONE_NUMBER_ID: z.string().default(""),
  WA_BUSINESS_ACCOUNT_ID: z.string().default(""),
  WA_ACCESS_TOKEN: z.string().default(""),
  WA_APP_SECRET: z.string().default(""),
  WA_WEBHOOK_MSG_DEDUPE_TTL_SEC: z.coerce.number().int().default(300)
});
```

### Test Webhook Verification Locally

```bash
# Test GET verification
curl "http://localhost:8080/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"

# Should return: test123
```

---

## ✅ 2.3 — SENDING MESSAGES (ENHANCED)

Your existing code already handles sending via Cloud API. Let's enhance it with better error handling.

### WhatsApp API Error Codes

**File:** `src/services/whatsappCloudApiSender.ts`

Add comprehensive error handling:

```typescript
interface WhatsAppError {
  code: number;
  message: string;
  type: string;
  error_subcode?: number;
  fbtrace_id?: string;
}

/**
 * Human-readable error messages for common WhatsApp API errors
 */
function getWhatsAppErrorMessage(error: WhatsAppError): string {
  const errorMessages: Record<number, string> = {
    130429: "Rate limit hit - too many messages sent. Try again later.",
    131048: "User number does not exist or is not a WhatsApp user.",
    131056: "User has blocked your business number.",
    133000: "24-hour customer care window has expired. User must message you first.",
    133004: "Phone number not registered with WhatsApp Business API.",
    133005: "Message template rejected or not approved.",
    133006: "Phone number is in pending registration or restricted.",
    131047: "Re-engagement message failed. User must initiate contact.",
    131026: "Message undeliverable - user may have blocked you or deleted account.",
    135000: "Generic internal server error from WhatsApp.",
    132000: "Recipient number is invalid (wrong format).",
    132001: "Access denied - check your access token permissions."
  };

  return errorMessages[error.code] || `WhatsApp API error: ${error.message}`;
}

/**
 * Check if error is recoverable (should retry)
 */
function isRecoverableError(code: number): boolean {
  const recoverableErrors = [
    135000, // Internal server error
    130429  // Rate limit (can retry after delay)
  ];
  return recoverableErrors.includes(code);
}

/**
 * Exponential backoff retry logic
 */
async function sendWithRetry(
  phoneNumberId: string,
  accessToken: string,
  payload: object,
  maxAttempts: number = 3
): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const waError = data.error as WhatsAppError;
        
        // Don't retry if error is not recoverable
        if (!isRecoverableError(waError.code)) {
          throw new Error(getWhatsAppErrorMessage(waError));
        }

        // Last attempt - throw error
        if (attempt === maxAttempts) {
          throw new Error(getWhatsAppErrorMessage(waError));
        }

        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return data;
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Unknown error");
}
```

### 24-Hour Window Warning

Add a helper to check if messaging window is open:

```typescript
/**
 * Check if user can receive messages (within 24-hour window)
 * Returns true if within window, false if expired
 */
export function checkCustomerCareWindow(lastUserMessageAt: Date): {
  allowed: boolean;
  expiresAt: Date | null;
  hoursRemaining: number;
} {
  const now = new Date();
  const windowMs = 24 * 60 * 60 * 1000; // 24 hours
  const elapsed = now.getTime() - lastUserMessageAt.getTime();
  const remaining = windowMs - elapsed;

  if (remaining > 0) {
    const expiresAt = new Date(lastUserMessageAt.getTime() + windowMs);
    const hoursRemaining = Math.floor(remaining / (60 * 60 * 1000));
    
    return {
      allowed: true,
      expiresAt,
      hoursRemaining
    };
  }

  return {
    allowed: false,
    expiresAt: null,
    hoursRemaining: 0
  };
}
```

### Store Message Status

Update your Prisma schema to track message delivery status:

```prisma
enum WhatsAppMessageStatus {
  QUEUED
  SENT
  DELIVERED
  READ
  FAILED
}

model DmMessage {
  id        String   @id @default(cuid())
  // ... existing fields ...
  
  // WhatsApp specific
  waMessageId  String?  // Meta's message ID
  waStatus     WhatsAppMessageStatus @default(QUEUED)
  waError      String?  // Error message if failed
  waStatusAt   DateTime? // When status was last updated
}
```

Run migration:
```bash
npx prisma migrate dev --name add_whatsapp_status
```

---

## ✅ 2.4 — REAL USER ONBOARDING FLOW

### Update Configuration Page

Users need to verify their WhatsApp connection works.

**File:** `dashboard/app/settings/whatsapp/page.tsx` (or similar)

Add a "Test Connection" button:

```typescript
async function testWhatsAppConnection(phoneNumber: string) {
  try {
    const response = await fetch("/api/whatsapp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber })
    });

    const data = await response.json();
    
    if (data.success) {
      toast.success("WhatsApp connection successful! Check your phone.");
    } else {
      toast.error(data.error || "Connection test failed");
    }
  } catch (error) {
    toast.error("Failed to test connection");
  }
}
```

### Create Test Endpoint

**File:** `src/routes/whatsapp.ts` (create if needed)

```typescript
import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { sendWhatsAppMessage } from "../services/whatsappCloudApiSender";
import { env } from "../config/env";
import { z } from "zod";

export const whatsappRouter = Router();

whatsappRouter.use(authenticate);

whatsappRouter.post("/test", async (req, res) => {
  try {
    const schema = z.object({
      phoneNumber: z.string().regex(/^\+[\d\s]{8,20}$/)
    });

    const { phoneNumber } = schema.parse(req.body);

    const result = await sendWhatsAppMessage({
      to: phoneNumber,
      body: "✅ WhatsApp connection successful! Your business is now ready to receive and send messages.",
      messageType: "text"
    });

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        message: "Test message sent successfully"
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || "Failed to send test message"
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Invalid request"
    });
  }
});
```

Register in `src/app.ts`:

```typescript
import { whatsappRouter } from "./routes/whatsapp";

app.use("/api/whatsapp", whatsappRouter);
```

---

## 📝 SECTION 2 COMPLETION CHECKLIST

### Manual Steps:
- [ ] Create Meta Developer App
- [ ] Add WhatsApp product
- [ ] Add and verify your phone number
- [ ] Get Phone Number ID and Business Account ID
- [ ] Generate permanent access token
- [ ] Configure webhook URL in Meta dashboard
- [ ] Subscribe to webhook fields (messages, message_status)
- [ ] Add all env vars to Render
- [ ] Test sending a message via curl

### Code Changes:
- [ ] Add GET verification endpoint to webhook router
- [ ] Add WEBHOOK_VERIFY_TOKEN to env schema
- [ ] Enhance error handling with retry logic
- [ ] Add 24-hour window checker
- [ ] Add message status tracking to database
- [ ] Create test connection endpoint
- [ ] Update frontend with test button

### Testing:
- [ ] Webhook verification works (GET request)
- [ ] Incoming message received and processed
- [ ] Test message sent successfully
- [ ] Error handling works (try invalid number)
- [ ] 24-hour window warning shows correctly
- [ ] Message status updates in database

---

## 🚨 COMMON ISSUES & SOLUTIONS

### Issue: Webhook verification fails
**Solution**: Ensure GET endpoint returns the exact `hub.challenge` value as plain text, not JSON.

### Issue: Messages not sending
**Solution**: Check access token permissions include `whatsapp_business_messaging`.

### Issue: "24-hour window expired" error
**Solution**: Implement template messages or wait for user to message you first.

### Issue: Rate limit errors
**Solution**: Implement exponential backoff and queue-based sending (already exists in your code).

### Issue: Webhook receives duplicate messages
**Solution**: Your deduplication logic (`WA_WEBHOOK_MSG_DEDUPE_TTL_SEC`) already handles this.

---

## 📚 Resources

- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [Graph API Reference](https://developers.facebook.com/docs/graph-api)
- [Error Codes Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/message-templates)

---

**Next:** Proceed to Section 3 — Database & Data Integrity
