/**
 * Generates postman/collections/social-media-controller-api.json (Collection v2.1).
 * Run: node scripts/build-postman-collection.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "postman", "collections");
fs.mkdirSync(outDir, { recursive: true });

function bearerAuth() {
  return {
    type: "bearer",
    bearer: [{ key: "token", value: "{{authToken}}", type: "string" }]
  };
}

function noAuth() {
  return { type: "noauth" };
}

function jsonBody(obj) {
  return {
    mode: "raw",
    raw: JSON.stringify(obj, null, 2)
  };
}

function R(name, method, urlPath, opts = {}) {
  const headers = [];
  const body = opts.body;
  if (body && ["POST", "PUT", "PATCH"].includes(method)) {
    headers.push({ key: "Content-Type", value: "application/json" });
  }
  if (opts.header) headers.push(...opts.header);
  const req = {
    method,
    header: headers,
    url: `{{baseUrl}}${urlPath}`,
    description: opts.description
  };
  if (body) req.body = jsonBody(body);
  if (opts.auth === "bearer") req.auth = bearerAuth();
  else if (opts.auth === "metrics") {
    req.auth = noAuth();
    req.header.push({ key: "x-pulse-metrics-key", value: "{{METRICS_SECRET}}" });
  } else if (opts.auth === false) req.auth = noAuth();
  else req.auth = bearerAuth();

  return { name, request: req };
}

/** Postman Tests tab — saves Bearer token after successful login. */
function loginPostmanTestEvents() {
  return [
    {
      listen: "test",
      script: {
        exec: [
          'pm.test("Auto-capture authToken", function () {',
          "  if (pm.response.code === 200) {",
          "    const json = pm.response.json();",
          "    const token = json.token || json.accessToken || json.data?.token;",
          "    if (token) {",
          '      pm.environment.set("authToken", token);',
          '      console.log("authToken saved to environment");',
          "    }",
          "  }",
          "});"
        ],
        type: "text/javascript"
      }
    }
  ];
}

const collection = {
  info: {
    _postman_id: "pulseos-api-collection",
    name: "social-media-controller API",
    description:
      "PulseOS backend — generated from src/routes and src/app.ts. Use postman/environments/*.json for baseUrl and authToken.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:4000" },
    { key: "authToken", value: "" },
    { key: "clientId", value: "" },
    { key: "socialAccountId", value: "" },
    { key: "postId", value: "" },
    { key: "METRICS_SECRET", value: "" }
  ],
  item: [
    {
      name: "Root & Health",
      item: [
        R("GET /", "GET", "/", { auth: false }),
        R("GET /health", "GET", "/health", { auth: false }),
        R("GET /api/health", "GET", "/api/health", { auth: false }),
        R("GET /api/health (deps)", "GET", "/api/health?deps=1", { auth: false }),
        R("GET /api/health/db", "GET", "/api/health/db", { auth: false }),
        R("GET /api/health/degraded", "GET", "/api/health/degraded", { auth: false }),
        R("GET /api/health/critical", "GET", "/api/health/critical", { auth: false }),
        R("GET /api/metrics", "GET", "/api/metrics", { auth: "metrics" })
      ]
    },
    {
      name: "API Root",
      item: [R("GET /api (Quadrapilot banner)", "GET", "/api/", { auth: false })]
    },
    {
      name: "Auth",
      item: [
        R("POST /api/auth/signup", "POST", "/api/auth/signup", {
          auth: false,
          body: { email: "demo@example.com", password: "password123", name: "Demo User" }
        }),
        {
          name: "POST /api/auth/login",
          event: loginPostmanTestEvents(),
          request: R("POST /api/auth/login", "POST", "/api/auth/login", {
            auth: false,
            body: { email: "demo@example.com", password: "password123" }
          }).request
        },
        R("POST /api/auth/logout", "POST", "/api/auth/logout", { auth: false, body: {} }),
        R("POST /api/auth/refresh", "POST", "/api/auth/refresh", {
          auth: false,
          body: { refreshToken: "<paste_refresh_token>" }
        }),
        R("GET /api/auth/me", "GET", "/api/auth/me", { auth: "bearer" }),
        R("PATCH /api/auth/me", "PATCH", "/api/auth/me", {
          auth: "bearer",
          body: { name: "Updated Name", email: "newemail@example.com" }
        }),
        R("GET /api/auth/oauth/instagram/authorise", "GET", "/api/auth/oauth/instagram/authorise", { auth: "bearer" }),
        R("GET /api/auth/instagram", "GET", "/api/auth/instagram", { auth: "bearer" }),
        R(
          "POST /api/auth/register",
          "POST",
          "/api/auth/register",
          {
            auth: "bearer",
            body: { email: "newuser@example.com", password: "password123", name: "New User", role: "CLIENT_USER" }
          }
        ),
        R("POST /api/auth/oauth/state", "POST", "/api/auth/oauth/state", {
          auth: false,
          body: { clientId: "{{clientId}}", platform: "INSTAGRAM" }
        }),
        R("POST /api/auth/oauth/validate", "POST", "/api/auth/oauth/validate", {
          auth: false,
          body: { state: "<oauth_state>" }
        })
      ]
    },
    {
      name: "Notifications",
      item: [
        R("POST /api/notifications (create)", "POST", "/api/notifications", {
          auth: "bearer",
          body: {
            type: "info",
            title: "Test notification",
            message: "Something happened worth knowing.",
            metadata: { source: "manual" }
          }
        }),
        R("GET /api/notifications", "GET", "/api/notifications", { auth: "bearer" }),
        R("GET /api/notifications (unread only)", "GET", "/api/notifications?unread=true&limit=50", { auth: "bearer" }),
        R("PATCH /api/notifications/read-all", "PATCH", "/api/notifications/read-all", { auth: "bearer", body: {} }),
        R("PATCH /api/notifications/:id/read", "PATCH", "/api/notifications/notif-id/read", { auth: "bearer", body: {} }),
        R("DELETE /api/notifications/:id", "DELETE", "/api/notifications/notif-id", { auth: "bearer" })
      ]
    },
    {
      name: "Analytics",
      item: [
        R("GET overview", "GET", "/api/analytics/{{clientId}}/overview?days=30", { auth: "bearer" }),
        R("GET posts", "GET", "/api/analytics/{{clientId}}/posts?limit=20&sort=engagement", { auth: "bearer" }),
        R("GET hourly insights", "GET", "/api/analytics/{{clientId}}/insights/hourly", { auth: "bearer" }),
        R("GET media-type insights", "GET", "/api/analytics/{{clientId}}/insights/media-type", { auth: "bearer" }),
        R("GET platform summary", "GET", "/api/analytics/INSTAGRAM/{{clientId}}/summary", { auth: "bearer" })
      ]
    },
    {
      name: "AI",
      item: [
        R("GET /api/ai", "GET", "/api/ai/", { auth: "bearer" }),
        R("POST insights content-performance", "POST", "/api/ai/insights/content-performance/{{clientId}}", {
          auth: "bearer",
          body: { platform: "INSTAGRAM" }
        }),
        R("POST captions/generate (body clientId)", "POST", "/api/ai/captions/generate", {
          auth: "bearer",
          body: {
            clientId: "{{clientId}}",
            niche: "local retail",
            tone: "friendly",
            objective: "drive foot traffic",
            offer: "10% off this week"
          }
        }),
        R("POST recommendations weekly", "POST", "/api/ai/recommendations/weekly/{{clientId}}", { auth: "bearer", body: {} }),
        R("POST dm-reply-preview", "POST", "/api/ai/dm-reply-preview", {
          auth: "bearer",
          body: {
            clientId: "{{clientId}}",
            businessContext: "We run a cafe in Bhubaneswar.",
            tone: "friendly",
            sampleUserMessage: "What are your hours?"
          }
        }),
        R("POST captions for client", "POST", "/api/ai/{{clientId}}/captions/generate", {
          auth: "bearer",
          body: { tone: "professional", goal: "announce a weekend sale", offer: "BOGO", niche: "cafe" }
        })
      ]
    },
    {
      name: "Insights",
      item: [
        R("GET latest content-performance", "GET", "/api/insights/{{clientId}}/content-performance/latest", {
          auth: "bearer"
        }),
        R("POST generate content-performance", "POST", "/api/insights/{{clientId}}/content-performance/generate", {
          auth: "bearer",
          body: {}
        }),
        R("POST feedback", "POST", "/api/insights/{{clientId}}/insight-id/feedback", {
          auth: "bearer",
          body: { helpful: true, comment: "Good" }
        })
      ]
    },
    {
      name: "Billing",
      item: [
        R("GET billing status", "GET", "/api/billing/{{clientId}}/status", { auth: "bearer" }),
        R("POST checkout", "POST", "/api/billing/checkout", {
          auth: "bearer",
          body: { planId: "pioneer", priceId: "price_optional_non_pioneer" }
        }),
        R("POST portal", "POST", "/api/billing/portal", { auth: "bearer", body: {} })
      ]
    },
    {
      name: "Agency",
      item: [
        R("GET usage", "GET", "/api/agency/usage", { auth: "bearer" }),
        R("GET branding", "GET", "/api/agency/branding", { auth: "bearer" }),
        R("POST branding", "POST", "/api/agency/branding", {
          auth: "bearer",
          body: { agencyName: "My Agency", brandColor: "#06b6d4" }
        })
      ]
    },
    {
      name: "Clients",
      item: [
        R("GET clients list", "GET", "/api/clients/", { auth: "bearer" }),
        R("POST create client", "POST", "/api/clients/", {
          auth: "bearer",
          body: { name: "New Client Business" }
        }),
        R("GET dm-settings", "GET", "/api/clients/{{clientId}}/dm-settings", { auth: "bearer" }),
        R("PATCH dm-settings", "PATCH", "/api/clients/{{clientId}}/dm-settings", {
          auth: "bearer",
          body: { dmAutoReplyEnabled: false }
        }),
        R("GET dm-conversations", "GET", "/api/clients/{{clientId}}/dm-conversations", { auth: "bearer" }),
        R(
          "GET dm conversation messages",
          "GET",
          "/api/clients/{{clientId}}/dm-conversations/conv-id/messages",
          { auth: "bearer" }
        ),
        R("GET sync-status", "GET", "/api/clients/{{clientId}}/sync-status", { auth: "bearer" }),
        R("GET profile", "GET", "/api/clients/{{clientId}}/profile", { auth: "bearer" }),
        R("PATCH profile", "PATCH", "/api/clients/{{clientId}}/profile", {
          auth: "bearer",
          body: { name: "Updated Client Name", businessType: "coaching", language: "en" }
        })
      ]
    },
    {
      name: "Leads",
      item: [
        R("GET leads", "GET", "/api/leads/?clientId={{clientId}}&page=1&limit=20", { auth: "bearer" }),
        R("PATCH lead", "PATCH", "/api/leads/lead-id", { auth: "bearer", body: { status: "CONTACTED" } })
      ]
    },
    {
      name: "Posts",
      item: [
        R("GET posts", "GET", "/api/posts/?clientId={{clientId}}", { auth: "bearer" }),
        R("POST post", "POST", "/api/posts/", {
          auth: "bearer",
          body: {
            clientId: "{{clientId}}",
            socialAccountId: "{{socialAccountId}}",
            caption: "Hello world",
            mediaUrls: [],
            hashtags: ["#pulse"],
            status: "DRAFT"
          }
        }),
        R("DELETE post", "DELETE", "/api/posts/{{postId}}", { auth: "bearer" })
      ]
    },
    {
      name: "Reports",
      item: [
        R("POST report (body clientId)", "POST", "/api/reports/", {
          auth: "bearer",
          body: { clientId: "{{clientId}}", reportType: "briefing" }
        }),
        R("POST export pdf", "POST", "/api/reports/{{clientId}}/export/pdf", {
          auth: "bearer",
          body: { reportType: "analytics" }
        })
      ]
    },
    {
      name: "Audit logs",
      item: [
        R("GET audit logs", "GET", "/api/audit-logs/?clientId={{clientId}}&page=1&perPage=20", { auth: "bearer" })
      ]
    },
    {
      name: "Social accounts",
      item: [
        R("GET list", "GET", "/api/social-accounts/", { auth: "bearer" }),
        R("DELETE account", "DELETE", "/api/social-accounts/{{socialAccountId}}", { auth: "bearer" }),
        R("POST connect facebook", "POST", "/api/social-accounts/connect/facebook", {
          auth: "bearer",
          body: { clientId: "{{clientId}}", accessToken: "token" }
        }),
        R("POST connect instagram", "POST", "/api/social-accounts/connect/instagram", {
          auth: "bearer",
          body: { clientId: "{{clientId}}", accessToken: "token" }
        }),
        R("POST connect linkedin", "POST", "/api/social-accounts/connect/linkedin", {
          auth: "bearer",
          body: { clientId: "{{clientId}}", accessToken: "token" }
        }),
        R("POST instagram start", "POST", "/api/social-accounts/instagram/start", {
          auth: "bearer",
          body: { clientId: "{{clientId}}" }
        }),
        R("POST create", "POST", "/api/social-accounts/", {
          auth: "bearer",
          body: { clientId: "{{clientId}}", platform: "INSTAGRAM", platformUserId: "123", platformUsername: "handle" }
        }),
        R("POST instagram exchange", "POST", "/api/social-accounts/instagram/exchange", {
          auth: "bearer",
          body: { code: "auth_code", clientId: "{{clientId}}" }
        })
      ]
    },
    {
      name: "Webhooks (platform)",
      item: [
        R("POST manual ingestion", "POST", "/api/webhooks/ingestion", {
          auth: "bearer",
          body: { socialAccountId: "{{socialAccountId}}", platform: "INSTAGRAM", trigger: "manual" }
        }),
        R("POST social webhook", "POST", "/api/webhooks/social/instagram", {
          auth: false,
          body: {
            socialAccountId: "{{socialAccountId}}",
            eventType: "comment",
            externalId: "ext-123",
            text: "Great post!",
            authorId: "user1",
            authorName: "Fan"
          },
          header: [{ key: "x-webhook-signature", value: "sha256=<hmac>" }]
        }),
        R("POST Postmark email", "POST", "/api/webhooks/email/postmark", {
          auth: false,
          body: { RecordType: "Delivery", MessageID: "msg-id", Email: "user@example.com" },
          header: [{ key: "x-postmark-webhook-token", value: "<optional_secret>" }]
        })
      ]
    },
    {
      name: "Quadrapilot",
      item: [
        R("POST execute", "POST", "/api/execute/", {
          auth: "bearer",
          body: {
            input: "Summarize Instagram best practices.",
            requestEmailOnCompletion: false,
            recipientEmail: "you@example.com",
            emailSubject: "Quadrapilot result"
          }
        }),
        R("POST message", "POST", "/api/message/", {
          auth: "bearer",
          body: { message: "Hello Quadrapilot", requestEmailOnCompletion: false }
        })
      ]
    },
    {
      name: "Instagram",
      item: [
        R("POST sync", "POST", "/api/instagram/sync", {
          auth: "bearer",
          body: { clientId: "{{clientId}}" }
        })
      ]
    },
    {
      name: "Pulse",
      item: [
        R("GET tiers", "GET", "/api/pulse/tiers", { auth: "bearer" }),
        R("GET client summary", "GET", "/api/pulse/client/summary?clientId={{clientId}}", { auth: "bearer" }),
        R("GET client briefings", "GET", "/api/pulse/client/briefings?clientId={{clientId}}&limit=7", {
          auth: "bearer"
        }),
        R("PATCH onboarding", "PATCH", "/api/pulse/client/onboarding", {
          auth: "bearer",
          body: { clientId: "{{clientId}}", businessType: "coaching", metricsTracked: ["followers", "leads"] }
        }),
        R("POST briefing opened", "POST", "/api/pulse/client/engagement/briefing-opened", {
          auth: "bearer",
          body: { clientId: "{{clientId}}" }
        })
      ]
    },
    {
      name: "Gov preview",
      item: [
        R("GET gov-preview", "GET", "/api/gov-preview", { auth: false }),
        R("GET pulse gov-preview", "GET", "/api/pulse/gov-preview", { auth: false })
      ]
    },
    {
      name: "Briefing",
      item: [
        R("GET latest", "GET", "/api/briefing/latest?clientId={{clientId}}", { auth: "bearer" }),
        R("GET record", "GET", "/api/briefing/record/briefing-id", { auth: "bearer" }),
        R("POST feedback", "POST", "/api/briefing/record/briefing-id/feedback", {
          auth: "bearer",
          body: { tipRating: "useful", freeText: "Helpful tips" }
        }),
        R("POST share", "POST", "/api/briefing/record/briefing-id/share", { auth: "bearer", body: {} }),
        R("POST retry", "POST", "/api/briefing/retry/{{clientId}}", { auth: "bearer", body: {} }),
        R("POST trigger", "POST", "/api/briefing/trigger", { auth: "bearer", body: { clientId: "{{clientId}}" } }),
        R("PATCH settings", "PATCH", "/api/briefing/settings", {
          auth: "bearer",
          body: { clientId: "{{clientId}}", briefingEnabled: true }
        })
      ]
    },
    {
      name: "Briefing public",
      item: [R("GET share token", "GET", "/api/briefing/public/share/token-here", { auth: false })]
    },
    {
      name: "Voice",
      item: [
        R("POST transcribe", "POST", "/api/voice/transcribe", { auth: "bearer", description: "Use form-data file field in Postman UI" }),
        R("POST generate", "POST", "/api/voice/generate", {
          auth: "bearer",
          body: { transcript: "Hello", clientId: "{{clientId}}" }
        }),
        R("POST save", "POST", "/api/voice/save", {
          auth: "bearer",
          body: { clientId: "{{clientId}}", caption: "Saved caption" }
        })
      ]
    },
    {
      name: "Admin",
      item: [R("GET system", "GET", "/api/admin/system", { auth: "bearer" })]
    },
    {
      name: "OAuth callbacks",
      item: [
        R("POST facebook callback", "POST", "/api/oauth/facebook/callback", { auth: false, body: {} }),
        R("GET facebook callback", "GET", "/api/oauth/facebook/callback?code=&state=", { auth: false }),
        R("POST instagram callback", "POST", "/api/oauth/instagram/callback", { auth: false, body: {} }),
        R("GET instagram callback", "GET", "/api/oauth/instagram/callback?code=&state=", { auth: false }),
        R("POST linkedin callback", "POST", "/api/oauth/linkedin/callback", { auth: false, body: {} }),
        R("GET linkedin callback", "GET", "/api/oauth/linkedin/callback?code=&state=", { auth: false })
      ]
    },
    {
      name: "SSE",
      item: [
        R(
          "GET events (EventSource)",
          "GET",
          "/api/events?access_token={{authToken}}&clientId={{clientId}}",
          { auth: false }
        )
      ]
    },
    {
      name: "Billing Stripe webhook",
      item: [
        R("POST Stripe webhook", "POST", "/api/billing/webhook", {
          auth: false,
          body: { id: "evt_test", type: "checkout.session.completed", data: { object: {} } },
          header: [{ key: "Stripe-Signature", value: "sig" }]
        })
      ]
    },
    {
      name: "Meta Instagram webhook",
      item: [
        R("GET verify", "GET", "/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=&hub.challenge=CHALLENGE", {
          auth: false
        }),
        R("POST webhook", "POST", "/api/webhook/instagram", {
          auth: false,
          body: { object: "instagram", entry: [] },
          header: [{ key: "x-hub-signature-256", value: "sha256=..." }]
        })
      ]
    },
    {
      name: "WhatsApp",
      item: [
        R("GET verify", "GET", "/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=&hub.challenge=CHALLENGE", {
          auth: false
        }),
        R("POST webhook", "POST", "/whatsapp/webhook", {
          auth: false,
          body: { object: "whatsapp_business_account", entry: [] },
          header: [{ key: "x-hub-signature-256", value: "sha256=..." }]
        })
      ]
    },
    {
      name: "Browser OAuth (app.ts)",
      item: [R("GET /auth/instagram", "GET", "/auth/instagram", { auth: "bearer" })]
    }
  ]
};

fs.writeFileSync(
  path.join(outDir, "social-media-controller-api.json"),
  JSON.stringify(collection, null, 2),
  "utf8"
);
console.log("Wrote", path.join(outDir, "social-media-controller-api.json"));
