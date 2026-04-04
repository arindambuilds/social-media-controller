"use client";

/** page-enter: `usePageEnter` + `key={pathname}` on the root wrapper. */

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, fetchMe } from "../../../lib/api";
import { getAccessToken } from "../../../lib/auth-storage";
import { FormToast, type FormToastVariant } from "../../../components/form-toast";
import { PageHeader } from "../../../components/ui/page-header";
import { usePulseSse } from "../../../hooks/usePulseSse";
import { usePageEnter } from "@/hooks/usePageEnter";

type Tone = "friendly" | "professional" | "casual" | "concise" | "playful";

type DmSettingsClient = {
  id: string;
  dmAutoReplyEnabled: boolean;
  dmBusinessContext: string | null;
  dmOwnerTone: string | null;
  whatsappNumber: string | null;
};

const CONTEXT_MAX = 1000;

const TONE_OPTIONS: Array<[Tone, string, string, string]> = [
  ["friendly", "Friendly", "Warm and conversational", "Hi! Thanks for reaching out — happy to help."],
  ["professional", "Professional", "Clear and polite", "Thank you for your message. Here is what we offer…"],
  ["casual", "Casual", "Relaxed and human", "Hey! Sure thing — let me tell you more."],
  ["concise", "Concise", "Short and direct", "Hi! Prices start at … Want details?"],
  ["playful", "Playful", "Light and upbeat", "Ooh, great question — we’ve got you covered."]
];

function normalizeTone(raw: string | null | undefined): Tone {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "professional" || s.includes("professional")) return "professional";
  if (s === "casual" || s.includes("casual")) return "casual";
  if (s === "concise" || s.includes("concise")) return "concise";
  if (s === "playful" || s.includes("playful")) return "playful";
  return "friendly";
}

function parseStructuredContext(raw: string): {
  industry: string;
  products: string;
  hours: string;
  location: string;
  escalate: string;
  extra: string;
} {
  const out = { industry: "", products: "", hours: "", location: "", escalate: "", extra: "" };
  const extraLines: string[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (/^Industry\s*:/i.test(t)) {
      out.industry = t.replace(/^Industry\s*:\s*/i, "");
      continue;
    }
    if (/^Products\/services\s*:/i.test(t)) {
      out.products = t.replace(/^Products\/services\s*:\s*/i, "");
      continue;
    }
    if (/^Hours\s*:/i.test(t)) {
      out.hours = t.replace(/^Hours\s*:\s*/i, "");
      continue;
    }
    if (/^Location\s*:/i.test(t)) {
      out.location = t.replace(/^Location\s*:\s*/i, "");
      continue;
    }
    if (/^Escalate if\b/i.test(t)) {
      out.escalate = t.replace(/^Escalate if\s*(customer mentions)?\s*:\s*/i, "");
      continue;
    }
    if (t) extraLines.push(t);
  }
  out.extra = extraLines.join("\n").trim();
  if (!out.industry && !out.products && extraLines.length) {
    out.extra = raw.trim();
  }
  return out;
}

function buildStructuredContext(p: {
  industry: string;
  products: string;
  hours: string;
  location: string;
  escalate: string;
  extra: string;
}): string {
  const parts: string[] = [];
  if (p.industry.trim()) parts.push(`Industry: ${p.industry.trim()}`);
  if (p.products.trim()) parts.push(`Products/services: ${p.products.trim()}`);
  if (p.hours.trim()) parts.push(`Hours: ${p.hours.trim()}`);
  if (p.location.trim()) parts.push(`Location: ${p.location.trim()}`);
  if (p.escalate.trim()) parts.push(`Escalate if customer mentions: ${p.escalate.trim()}`);
  if (p.extra.trim()) parts.push("", p.extra.trim());
  return parts.join("\n").trim();
}

function whatsappValid(value: string): boolean {
  const t = value.trim();
  if (t === "") return true;
  if (!t.startsWith("+")) return false;
  return /^\+[\d\s]+$/.test(t) && /\d/.test(t.replace(/\s/g, ""));
}

function DmSettingsSkeleton() {
  return (
    <div className="page-shell">
      <div className="mb-8">
        <div className="skeleton mb-2 h-3 w-24 rounded" />
        <div className="skeleton mb-3 h-9 w-2/3 max-w-md rounded" />
        <div className="skeleton h-4 w-full max-w-xl rounded" />
      </div>
      <div className="gradient-border p-6 md:p-8">
        <div className="skeleton mb-6 h-12 w-full rounded-xl" />
        <div className="skeleton mb-2 h-4 w-40 rounded" />
        <div className="skeleton mb-4 h-28 w-full rounded-xl" />
        <div className="skeleton h-10 w-36 rounded-lg" />
      </div>
    </div>
  );
}

export default function DmSettingsPage() {
  const pathname = usePathname();
  const pageClassName = usePageEnter();
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dmAutoReplyEnabled, setDmAutoReplyEnabled] = useState(false);
  const [industry, setIndustry] = useState("");
  const [products, setProducts] = useState("");
  const [hours, setHours] = useState("");
  const [location, setLocation] = useState("");
  const [escalate, setEscalate] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [dmOwnerTone, setDmOwnerTone] = useState<Tone>("friendly");
  const [whatsappNumber, setWhatsappNumber] = useState("");

  const [sampleMessage, setSampleMessage] = useState("Hi, what are your prices?");
  const [previewReply, setPreviewReply] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ tokens?: number; ms?: number; cached?: boolean } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const composedContext = useMemo(() => {
    const built = buildStructuredContext({ industry, products, hours, location, escalate, extra: extraNotes });
    return built.slice(0, CONTEXT_MAX);
  }, [industry, products, hours, location, escalate, extraNotes]);

  const [initial, setInitial] = useState<{
    dmAutoReplyEnabled: boolean;
    industry: string;
    products: string;
    hours: string;
    location: string;
    escalate: string;
    extraNotes: string;
    dmOwnerTone: Tone;
    whatsappNumber: string;
  } | null>(null);

  const [toast, setToast] = useState<{ text: string; variant: FormToastVariant } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const dirty = useMemo(() => {
    if (!initial) return false;
    return (
      dmAutoReplyEnabled !== initial.dmAutoReplyEnabled ||
      industry !== initial.industry ||
      products !== initial.products ||
      hours !== initial.hours ||
      location !== initial.location ||
      escalate !== initial.escalate ||
      extraNotes !== initial.extraNotes ||
      dmOwnerTone !== initial.dmOwnerTone ||
      whatsappNumber !== initial.whatsappNumber
    );
  }, [initial, dmAutoReplyEnabled, industry, products, hours, location, escalate, extraNotes, dmOwnerTone, whatsappNumber]);

  const contextOk = !dmAutoReplyEnabled || composedContext.length > 0;
  const whatsappOk = whatsappValid(whatsappNumber);
  const canSave = dirty && !saving && contextOk && whatsappOk;

  usePulseSse(clientId, { enabled: Boolean(clientId) });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const me = await fetchMe();
        let cid = me.user.clientId;
        if (me.user.role === "CLIENT_USER" && !cid) {
          setLoadError("No client assigned.");
          setFetching(false);
          return;
        }
        if (me.user.role === "AGENCY_ADMIN" && !cid) {
          cid = "demo-client";
        }
        if (!cid) {
          setLoadError("No client context.");
          setFetching(false);
          return;
        }
        setClientId(cid);

        const res = await apiFetch<{ success?: boolean; client: DmSettingsClient }>(
          `/clients/${encodeURIComponent(cid)}/dm-settings`
        );
        const c = res.client;
        const tone = normalizeTone(c.dmOwnerTone);
        const parsed = parseStructuredContext((c.dmBusinessContext ?? "").slice(0, CONTEXT_MAX));

        setDmAutoReplyEnabled(!!c.dmAutoReplyEnabled);
        setIndustry(parsed.industry);
        setProducts(parsed.products);
        setHours(parsed.hours);
        setLocation(parsed.location);
        setEscalate(parsed.escalate);
        setExtraNotes(parsed.extra);
        setDmOwnerTone(tone);
        setWhatsappNumber(c.whatsappNumber ?? "");
        setInitial({
          dmAutoReplyEnabled: !!c.dmAutoReplyEnabled,
          industry: parsed.industry,
          products: parsed.products,
          hours: parsed.hours,
          location: parsed.location,
          escalate: parsed.escalate,
          extraNotes: parsed.extra,
          dmOwnerTone: tone,
          whatsappNumber: c.whatsappNumber ?? ""
        });
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        setFetching(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!clientId || !dmAutoReplyEnabled || !composedContext.trim()) {
      setPreviewReply(null);
      setPreviewMeta(null);
      return;
    }
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      void (async () => {
        setPreviewLoading(true);
        try {
          const res = await apiFetch<{
            success?: boolean;
            reply: string;
            tokensUsed?: number;
            latencyMs?: number;
            cached?: boolean;
          }>("/ai/dm-reply-preview", {
            method: "POST",
            body: JSON.stringify({
              clientId,
              businessContext: composedContext,
              tone: dmOwnerTone,
              sampleUserMessage: sampleMessage.trim() || "Hi, what are your prices?"
            })
          });
          setPreviewReply(res.reply ?? "");
          setPreviewMeta({
            tokens: res.tokensUsed,
            ms: res.latencyMs,
            cached: res.cached
          });
        } catch {
          setPreviewReply(null);
          setPreviewMeta(null);
        } finally {
          setPreviewLoading(false);
        }
      })();
    }, 800);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [clientId, dmAutoReplyEnabled, composedContext, dmOwnerTone, sampleMessage]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !canSave) return;
    if (dmAutoReplyEnabled && !composedContext.trim()) {
      setToast({ text: "Failed to save — please try again", variant: "error" });
      return;
    }
    if (!whatsappValid(whatsappNumber)) {
      setToast({ text: "Failed to save — please try again", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const body = {
        dmAutoReplyEnabled,
        dmBusinessContext: composedContext.trim() || null,
        dmOwnerTone,
        whatsappNumber: whatsappNumber.trim() === "" ? null : whatsappNumber.trim()
      };
      const res = await apiFetch<{ success?: boolean; client: DmSettingsClient }>(
        `/clients/${encodeURIComponent(clientId)}/dm-settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      const c = res.client;
      const tone = normalizeTone(c.dmOwnerTone);
      const parsed = parseStructuredContext((c.dmBusinessContext ?? "").slice(0, CONTEXT_MAX));
      setDmAutoReplyEnabled(!!c.dmAutoReplyEnabled);
      setIndustry(parsed.industry);
      setProducts(parsed.products);
      setHours(parsed.hours);
      setLocation(parsed.location);
      setEscalate(parsed.escalate);
      setExtraNotes(parsed.extra);
      setDmOwnerTone(tone);
      setWhatsappNumber(c.whatsappNumber ?? "");
      setInitial({
        dmAutoReplyEnabled: !!c.dmAutoReplyEnabled,
        industry: parsed.industry,
        products: parsed.products,
        hours: parsed.hours,
        location: parsed.location,
        escalate: parsed.escalate,
        extraNotes: parsed.extra,
        dmOwnerTone: tone,
        whatsappNumber: c.whatsappNumber ?? ""
      });
      setToast({ text: "DM settings saved", variant: "success" });
    } catch {
      setToast({ text: "Failed to save — please try again", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  const fieldsDisabled = !dmAutoReplyEnabled;

  if (fetching) {
    return (
      <div key={pathname} className={pageClassName}>
        <DmSettingsSkeleton />
      </div>
    );
  }

  return (
    <div key={pathname} className={`page-shell ${pageClassName}`}>
      <PageHeader
        eyebrow="Instagram"
        title="DM auto-reply"
        description="Structured business profile, tone, and a live Claude preview — same rules as production replies."
      />

      {loadError ? <p className="text-error mb-4">{loadError}</p> : null}

      <form onSubmit={onSave} className="mt-6">
        <div className="gradient-border p-6 md:p-8">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <label htmlFor="dm-auto" className="text-ink block text-base font-bold">
                Auto-reply to Instagram DMs
              </label>
              <p className="text-muted mt-1 max-w-xl text-sm">
                Claude uses the profile below for every incoming DM when this is on.
              </p>
            </div>
            <button
              id="dm-auto"
              type="button"
              role="switch"
              aria-checked={dmAutoReplyEnabled}
              className={`relative h-9 w-[52px] shrink-0 rounded-full border transition-colors ${
                dmAutoReplyEnabled
                  ? "border-blue-500 bg-blue-500/40"
                  : "border-subtle bg-surface"
              }`}
              onClick={() => setDmAutoReplyEnabled((v) => !v)}
            >
              <span
                className={`absolute top-1 h-7 w-7 rounded-full bg-ink shadow transition-transform ${
                  dmAutoReplyEnabled ? "translate-x-[22px]" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="dm-industry" className="text-ink mb-1 block text-sm font-bold">
                Industry
              </label>
              <input
                id="dm-industry"
                className="input w-full disabled:opacity-50"
                placeholder="e.g. Salon, Cafe, Gym"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                disabled={fieldsDisabled}
              />
            </div>
            <div>
              <label htmlFor="dm-products" className="text-ink mb-1 block text-sm font-bold">
                Products / services
              </label>
              <input
                id="dm-products"
                className="input w-full disabled:opacity-50"
                placeholder="Comma-separated: cuts, colour, spa"
                value={products}
                onChange={(e) => setProducts(e.target.value)}
                disabled={fieldsDisabled}
              />
            </div>
            <div>
              <label htmlFor="dm-hours" className="text-ink mb-1 block text-sm font-bold">
                Opening hours
              </label>
              <input
                id="dm-hours"
                className="input w-full disabled:opacity-50"
                placeholder="e.g. 10:00–20:00 IST, closed Sunday"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                disabled={fieldsDisabled}
              />
            </div>
            <div>
              <label htmlFor="dm-location" className="text-ink mb-1 block text-sm font-bold">
                Location
              </label>
              <input
                id="dm-location"
                className="input w-full disabled:opacity-50"
                placeholder="Area, city"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={fieldsDisabled}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="dm-escalate" className="text-ink mb-1 block text-sm font-bold">
                Escalation keywords
              </label>
              <input
                id="dm-escalate"
                className="input w-full disabled:opacity-50"
                placeholder="e.g. complaint, refund, manager"
                value={escalate}
                onChange={(e) => setEscalate(e.target.value)}
                disabled={fieldsDisabled}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="dm-extra" className="text-ink mb-1 block text-sm font-bold">
                Extra notes for Claude
              </label>
              <textarea
                id="dm-extra"
                className="textarea min-h-[80px] w-full resize-y disabled:opacity-50"
                placeholder="Anything else customers ask about…"
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value.slice(0, CONTEXT_MAX))}
                disabled={fieldsDisabled}
              />
              <p className="text-muted mt-1 text-xs tabular-nums">
                Profile length {composedContext.length} / {CONTEXT_MAX}
              </p>
            </div>
          </div>

          <fieldset disabled={fieldsDisabled} className="mb-8 min-w-0 border-0 p-0">
            <legend className="text-ink mb-3 block text-sm font-bold">Reply tone</legend>
            <div className="flex flex-col gap-3">
              {TONE_OPTIONS.map(([value, title, sub, sample]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                    dmOwnerTone === value
                      ? "border-blue-500/50 bg-blue-500/10"
                      : "border-subtle bg-surface/50"
                  } ${fieldsDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <input
                    type="radio"
                    name="dmOwnerTone"
                    value={value}
                    checked={dmOwnerTone === value}
                    onChange={() => setDmOwnerTone(value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="text-ink block font-semibold">{title}</span>
                    <span className="text-muted text-sm">{sub}</span>
                    <span className="text-accent-teal mt-2 block text-xs italic">&ldquo;{sample}&rdquo;</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="border-subtle mb-8 rounded-2xl border bg-surface/60 p-5">
            <h3 className="text-ink font-display text-base font-bold">Live reply preview</h3>
            <p className="text-muted mt-1 text-sm">
              Debounced ~800ms after you stop typing. Same prompt family as production (rate-limited).
            </p>
            <label htmlFor="dm-sample" className="text-ink mt-4 mb-1 block text-sm font-bold">
              Sample customer message
            </label>
            <input
              id="dm-sample"
              className="input mb-4 w-full max-w-xl disabled:opacity-50"
              value={sampleMessage}
              onChange={(e) => setSampleMessage(e.target.value)}
              disabled={fieldsDisabled}
            />
            <div className="rounded-xl border border-accent-teal/30 bg-accent-teal/5 px-4 py-3">
              {previewLoading ? (
                <p className="text-muted text-sm">Claude is composing…</p>
              ) : previewReply ? (
                <>
                  <p className="text-ink m-0 text-sm leading-relaxed">{previewReply}</p>
                  {previewMeta ? (
                    <p className="text-muted mt-2 text-xs">
                      {previewMeta.tokens != null ? `${previewMeta.tokens} tokens` : null}
                      {previewMeta.ms != null ? ` · ${previewMeta.ms} ms` : null}
                      {previewMeta.cached ? " · cached" : ""}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-muted text-sm">Turn on auto-reply and fill your profile to see a preview.</p>
              )}
            </div>
          </div>

          <div className="mb-8">
            <label htmlFor="dm-wa" className="text-ink block text-sm font-bold">
              WhatsApp escalation number
            </label>
            <p className="text-muted mb-2 text-sm">
              Claude sends a WhatsApp alert here when it cannot reply with high confidence
            </p>
            <input
              id="dm-wa"
              type="text"
              className="input max-w-md disabled:opacity-50"
              placeholder="+91 98765 43210"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              disabled={fieldsDisabled}
              autoComplete="tel"
            />
            {!whatsappOk ? (
              <p className="text-danger mt-1 text-xs">Use + followed by digits and spaces only.</p>
            ) : null}
          </div>

          {dmAutoReplyEnabled && !contextOk ? (
            <p className="text-danger mb-4 text-sm">Add at least one field in your business profile when auto-reply is on.</p>
          ) : null}

          <button type="submit" className="button" disabled={!canSave}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      <FormToast
        message={toast?.text ?? null}
        variant={toast?.variant ?? "success"}
        onDismiss={dismissToast}
      />
    </div>
  );
}
