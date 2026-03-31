# 9:00 AM Asia/Kolkata briefings — code truth + rehearsal

Use this for the next **24–48 hours** to align the **“9 AM briefings”** narrative with **how the repo actually runs**, and to rehearse before Startup Odisha / investor decks.

---

## Stakeholder / deck language (verbatim)

Use this on slides or in spoken narrative:

> We run daily briefings at **9:00 AM Asia/Kolkata** using **BullMQ** and **node-cron** with **`0 9 * * *`** and **`tz: "Asia/Kolkata"`** — **no manual UTC math** in how we configure the scheduler.

---

## 1. Code confirmation (already in repo)

### BullMQ — fixed 09:00 IST tick (`nine_am_ist` mode)

`src/queues/whatsappBriefingQueue.ts` registers a **job scheduler** via **`upsertJobScheduler`** (idempotent across deploys):

```26:36:src/queues/whatsappBriefingQueue.ts
export async function registerWhatsAppBriefingNineAmRepeatable(): Promise<void> {
  if (!whatsappBriefingQueue) return;
  await whatsappBriefingQueue.upsertJobScheduler(
    "whatsapp-briefing-9am-ist",
    { pattern: "0 9 * * *", tz: "Asia/Kolkata" },
    {
      name: "send-daily",
      data: {},
      opts: repeatOpts
    }
  );
}
```

This path is active when **`BRIEFING_DISPATCH_MODE=nine_am_ist`**, Redis is configured, production workers run, and **`registerWhatsAppBriefingNineAmRepeatable()`** succeeds (from **`initMaintenanceJobs()`** in the maintenance worker bootstrap). See also [`DEPLOYMENT.md`](../DEPLOYMENT.md) → “Morning briefing”.

### node-cron — same wall-clock intent (opt-in, no Redis)

`src/jobs/briefingDispatch.ts`:

```97:118:src/jobs/briefingDispatch.ts
  morningCron = cron.schedule(
    "0 9 * * *",
    () => {
      void (async () => {
        const clients = await prisma.client.findMany({
          where: { briefingEnabled: true },
          select: { id: true }
        });
        for (const c of clients) {
          try {
            await runBriefingDispatchNow(c.id);
          } catch (e) {
            logger.warn("[briefingDispatch] morning run failed", {
              clientId: c.id,
              message: e instanceof Error ? e.message : String(e)
            });
          }
        }
      })();
    },
    { timezone: "Asia/Kolkata" }
  );
```

This runs only when **`PULSE_BILINGUAL_CRON=1`** and **Redis is not** configured (bilingual Claude path). **Production with Redis** uses BullMQ + `morningBriefing` / `dispatch-hour` / `whatsapp-briefing` instead — do not enable duplicate sends.

### Default production mode (when `nine_am_ist` is **not** set)

If **`BRIEFING_DISPATCH_MODE`** is unset, the **`briefing`** queue uses an **hourly** repeatable at **`:00` Asia/Kolkata** (`dispatch-hour`). Each client’s send time is gated by **`briefingHourIst`** in Prisma (default **8** in schema; onboarding may set **9**). The **“9 AM”** story in that mode means: **clients configured with `briefingHourIst: 9` get their briefing when the hourly tick is 09:00 IST**, not a separate cron string per client.

**For a single clean slide:** prefer explaining **`nine_am_ist`** + **`0 9 * * *`**, **`Asia/Kolkata`**, or explicitly say **“hourly IST tick + per-client hour.”**

---

## 2. Bull Board and production observability

**This repository does not ship [@bull-board](https://github.com/felixmosh/bull-board) (or similar)** — there is no in-app Bull Board route in `src/`.

**Operators can still verify repeatables by:**

| Method | What to do |
|--------|------------|
| **Render logs** | After deploy, look for **`Briefing: whatsapp-briefing queue @ 09:00 Asia/Kolkata (nine_am_ist mode)`** (maintenance worker) or hourly briefing logs. |
| **Log grep** | Search for **`whatsapp-briefing-9am-ist`**, **`[briefingWorker]`**, **`[whatsapp]`**, **`Twilio SID`**. |
| **Redis** | Inspect BullMQ keys / job schedulers for queue **`whatsapp-briefing`** and scheduler id **`whatsapp-briefing-9am-ist`** (`redis-cli` / Upstash). |
| **Future** | Add Bull Board behind auth on an internal route if you want a GUI — not required for the deck sentence above. |

If you **do** run Bull Board elsewhere, you should see a repeatable job whose pattern is **`0 9 * * *`** and timezone **`Asia/Kolkata`** for the **`whatsapp-briefing`** queue (when `nine_am_ist` is on).

---

## 3. Rehearsal plan (fill in the date)

**Target window:** **9:00 AM Asia/Kolkata** on **___________** (date).

### Before 9:00 IST

- [ ] **Render** API service **live** (warm or accept cold-start risk — hit `/api/health` ~15 min before).  
- [ ] **Redis** reachable from Render (`REDIS_URL`).  
- [ ] Env: **`BRIEFING_DISPATCH_MODE=nine_am_ist`** if you want the **single 9 AM BullMQ** story to match the deck line exactly; otherwise confirm **`briefingHourIst`** for demo clients is **9** and you understand the **hourly** dispatcher.  
- [ ] **Twilio** + **`ANTHROPIC_API_KEY`** set; test **`Client`** has **`whatsappNumber`** + **`briefingEnabled`**.  
- [ ] Logs / Redis / optional Bull Board tab **open**.  
- [ ] Optional: **one-off** earlier test (e.g. `BRIEFING_E2E_TEST_*` per `quadrapilot/README.md`) so you are not debugging only at 9:00.

### At / after 9:00 IST

- [ ] Briefing **job fired** (logs or queue).  
- [ ] **WhatsApp** received on at least **one** test handset.  
- [ ] No unhandled errors in Render logs for **`briefing`** / **`whatsapp-briefing`** / **`whatsapp-send`**.

### Within ~1 hour (gov metrics + ISR)

- [ ] Open **`/gov-preview`** (Vercel) — metrics may lag up to **~1 hour** (`revalidate = 3600`).  
- [ ] If numbers look stale, confirm **`refreshGovMetrics`** / Redis key **`briefing:gov:metrics`** on the API side (see `src/jobs/refreshGovMetrics.ts`).

---

## 4. Quick reference

| Mechanism | Pattern | Timezone | When it runs |
|-----------|---------|----------|----------------|
| BullMQ `whatsapp-briefing` | `0 9 * * *` | `Asia/Kolkata` | `BRIEFING_DISPATCH_MODE=nine_am_ist` + worker |
| BullMQ `briefing` `dispatch-hour` | `0 * * * *` | `Asia/Kolkata` | Default; matches `briefingHourIst` per client |
| node-cron bilingual | `0 9 * * *` | `Asia/Kolkata` | `PULSE_BILINGUAL_CRON=1`, **no** Redis |

---

## Related

- [`DEPLOYMENT.md`](../DEPLOYMENT.md) — env + worker notes  
- [`docs/cycle3-antigravity-tech-status.md`](./cycle3-antigravity-tech-status.md) — canonical **9:00 Asia/Kolkata** phrasing for Slack/Notion  
- [`quadrapilot/README.md`](../quadrapilot/README.md) — live WhatsApp E2E (C1)  
