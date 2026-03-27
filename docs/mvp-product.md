# MVP product definition

## One line

**An Instagram growth copilot for Indian local businesses and creators** — connect your account, see what performs, get AI insights and content help.

## Who it’s for

- Instagram-first **content creators**
- **SMBs**: salons, cafés, gyms, boutiques, coaching centres, clinics, local services  
- **Geography:** India-first language and examples; pilot lane **Bhubaneswar / Odisha** before scaling.

## Pain we solve

- Owners don’t have time to decode Insights or guess posting times.  
- “What should I post next?” is unanswered without hiring marketing help.  
- Generic global tools don’t speak **local business** context.

## Release posture

This repo is treated as an **MVP release candidate**: scope is frozen except fixes needed for demos and pilots. See **`docs/launch-checklist.md`** for the explicit in/out boundary.

## MVP promise (ship in 2 weeks of focused work)

1. **Connect** Instagram (OAuth; mock path for demo when Meta isn’t ready).  
2. **Sync** posts and basic engagement into our DB.  
3. **Dashboard** — simple analytics and “what matters” copy.  
4. **AI** — insights, weekly-style recommendation, captions (quality depends on `OPENAI_API_KEY`).  
5. **Credible demo** — seeded local-business story, no fake customers.

## What we are **not** building yet

- Multi-platform scheduling for Twitter, LinkedIn, TikTok, etc.  
- Full ad campaign management  
- White-label enterprise  
- Guaranteed ROI or “viral” claims  

## Language to use with users and mentors

- **Use:** Copilot, clarity, posting window, content performance, pilot, feedback.  
- **Avoid:** “Fully autonomous AI marketer,” “guaranteed growth,” invented metrics or logos.

## Pilot readiness (Odisha / India)

- Position as **decision support**: clearer posting rhythm and measurable follow-up (DMs, bookings you already track), not guaranteed reach.  
- **Mock ingestion** (`INGESTION_MODE=mock`) is valid for demos; real Instagram path when Meta app and tokens are ready.
