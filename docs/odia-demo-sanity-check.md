# Odia-first behavior — demo sanity (next 24–48 hours)

**Goal:** The line *“Odia-first WhatsApp AI growth copilot”* matches what you actually show.

## 1. Pick 3–5 realistic MSME prompts (examples)

Run in **Odia** where possible (Unicode Odia script). Examples to adapt:

| # | Intent | Example (Odia / mixed) |
|---|--------|-------------------------|
| 1 | Weekly contacts | “ଏହି ସପ୍ତାହରେ କେତେ ଗ୍ରାହକ ମୋତେ ମେସେଜ୍ କରିଛନ୍ତି?” |
| 2 | Simple price | “ମୋ ଦୋକାନରେ ଏକ ସାଡ଼ିର ଦର କ’ଣ କହିବି?” |
| 3 | Lead follow-up | “ଗତକାଲି ଯେ ଲିଡ୍ ଆସିଥିଲା — ତାକୁ କ’ଣ ରିପ୍ଲାଏ ଦେବି?” |
| 4 | Content nudge | “ଆଜି ଇନଷ୍ଟାଗ୍ରାମରେ କ’ଣ ପୋଷ୍ଟ କରିବି?” |
| 5 | Hours / location | “ଆମ ଦୋକାନ କେବେ ଖୋଲା — ଗ୍ରାହକଙ୍କୁ କ’ଣ ଲେଖିବି?” |

## 2. Run end-to-end on WhatsApp (dev or staging)

- Use a **test handset** and sandbox rules (e.g. Twilio **join** keyword if applicable).  
- **Observe:** replies should default to **Odia** when the client / flow is configured for **`language: "or"`**; **English** only where fallback is reasonable (errors, model refusal, mixed input).

## 3. Code / prompt levers (if output drifts English)

- **`Client.language`** in Prisma (`en` | `or`).  
- **`src/lib/claudeClient.ts`** — `generateBriefing` uses Odia system instruction when `language === "or"`.  
- **`src/jobs/briefingDispatch.ts`** — WhatsApp body uses **`or`** vs **`en`** from bilingual JSON.  
- Adjust **templates** / **briefing** prompts only with a quick **regression check** (`npm test`).

## 4. Capture proof for the room

- **1–2 screenshots** or **redacted logs** of strong Odia replies.  
- Keep **PII out** of slides (blur phone numbers, customer names).

## Related

- [`briefing-9am-ist-rehearsal.md`](./briefing-9am-ist-rehearsal.md) — same demo window, cron + WhatsApp.  
- [`final-demo-hardening.md`](./final-demo-hardening.md) — last-24h checklist.
