"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, fetchMe } from "../../../lib/api";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../../lib/auth-storage";
import { FormToast, type FormToastVariant } from "../../../components/form-toast";
import { PageHeader } from "../../../components/ui/page-header";

type Tone = "friendly" | "professional" | "casual";

type DmSettingsClient = {
  id: string;
  dmAutoReplyEnabled: boolean;
  dmBusinessContext: string | null;
  dmOwnerTone: string | null;
  whatsappNumber: string | null;
};

const CONTEXT_MAX = 1000;

function normalizeTone(raw: string | null | undefined): Tone {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "professional" || s.includes("professional")) return "professional";
  if (s === "casual" || s.includes("casual")) return "casual";
  return "friendly";
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
        <div className="skeleton mb-6 h-10 w-full rounded-xl" />
        <div className="skeleton h-10 w-36 rounded-lg" />
      </div>
    </div>
  );
}

export default function DmSettingsPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dmAutoReplyEnabled, setDmAutoReplyEnabled] = useState(false);
  const [dmBusinessContext, setDmBusinessContext] = useState("");
  const [dmOwnerTone, setDmOwnerTone] = useState<Tone>("friendly");
  const [whatsappNumber, setWhatsappNumber] = useState("");

  const [initial, setInitial] = useState<{
    dmAutoReplyEnabled: boolean;
    dmBusinessContext: string;
    dmOwnerTone: Tone;
    whatsappNumber: string;
  } | null>(null);

  const [toast, setToast] = useState<{ text: string; variant: FormToastVariant } | null>(null);

  const dismissToast = useCallback(() => setToast(null), []);

  const dirty = useMemo(() => {
    if (!initial) return false;
    return (
      dmAutoReplyEnabled !== initial.dmAutoReplyEnabled ||
      dmBusinessContext !== initial.dmBusinessContext ||
      dmOwnerTone !== initial.dmOwnerTone ||
      whatsappNumber !== initial.whatsappNumber
    );
  }, [initial, dmAutoReplyEnabled, dmBusinessContext, dmOwnerTone, whatsappNumber]);

  const contextOk = !dmAutoReplyEnabled || dmBusinessContext.trim().length > 0;
  const whatsappOk = whatsappValid(whatsappNumber);
  const canSave = dirty && !saving && contextOk && whatsappOk;

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const me = await fetchMe();
        let cid = getStoredClientId() ?? me.user.clientId;
        if (me.user.role === "CLIENT_USER" && !cid) {
          setLoadError("No client assigned.");
          setFetching(false);
          return;
        }
        if (me.user.role === "AGENCY_ADMIN" && !cid) {
          cid = "demo-client";
          localStorage.setItem(CLIENT_ID_KEY, cid);
        }
        if (!cid) {
          setLoadError("No client context.");
          setFetching(false);
          return;
        }
        setClientId(cid);
        localStorage.setItem(CLIENT_ID_KEY, cid);

        const res = await apiFetch<{ success?: boolean; client: DmSettingsClient }>(
          `/clients/${encodeURIComponent(cid)}/dm-settings`
        );
        const c = res.client;
        const tone = normalizeTone(c.dmOwnerTone);
        const ctx = (c.dmBusinessContext ?? "").slice(0, CONTEXT_MAX);
        const wa = c.whatsappNumber ?? "";

        setDmAutoReplyEnabled(!!c.dmAutoReplyEnabled);
        setDmBusinessContext(ctx);
        setDmOwnerTone(tone);
        setWhatsappNumber(wa);
        setInitial({
          dmAutoReplyEnabled: !!c.dmAutoReplyEnabled,
          dmBusinessContext: ctx,
          dmOwnerTone: tone,
          whatsappNumber: wa
        });
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        setFetching(false);
      }
    })();
  }, [router]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !canSave) return;
    if (dmAutoReplyEnabled && !dmBusinessContext.trim()) {
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
        dmBusinessContext: dmBusinessContext.trim() || null,
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
      const ctx = (c.dmBusinessContext ?? "").slice(0, CONTEXT_MAX);
      const wa = c.whatsappNumber ?? "";
      setDmAutoReplyEnabled(!!c.dmAutoReplyEnabled);
      setDmBusinessContext(ctx);
      setDmOwnerTone(tone);
      setWhatsappNumber(wa);
      setInitial({
        dmAutoReplyEnabled: !!c.dmAutoReplyEnabled,
        dmBusinessContext: ctx,
        dmOwnerTone: tone,
        whatsappNumber: wa
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
    return <DmSettingsSkeleton />;
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Instagram"
        title="DM auto-reply"
        description="Claude replies in your tone, captures leads, and escalates uncertain threads over WhatsApp."
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
                Claude will respond to incoming DMs automatically based on your business context below
              </p>
            </div>
            <button
              id="dm-auto"
              type="button"
              role="switch"
              aria-checked={dmAutoReplyEnabled}
              className={`relative h-9 w-[52px] shrink-0 rounded-full border transition-colors ${
                dmAutoReplyEnabled
                  ? "border-accent-purple bg-accent-purple/40"
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

          <div className="mb-6">
            <label htmlFor="dm-context" className="text-ink mb-2 block text-sm font-bold">
              Business context
            </label>
            <textarea
              id="dm-context"
              className="textarea min-h-[120px] w-full resize-y disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Describe your business, what you sell, your location, opening hours, and anything a customer might ask about..."
              rows={5}
              maxLength={CONTEXT_MAX}
              value={dmBusinessContext}
              onChange={(e) => setDmBusinessContext(e.target.value.slice(0, CONTEXT_MAX))}
              disabled={fieldsDisabled}
              required={dmAutoReplyEnabled}
            />
            <div className="text-muted mt-1 flex justify-between text-xs">
              <span>
                {dmAutoReplyEnabled && dmBusinessContext.trim().length === 0 ? (
                  <span className="text-danger">Required when auto-reply is on</span>
                ) : null}
              </span>
              <span className="tabular-nums">
                {dmBusinessContext.length} / {CONTEXT_MAX}
              </span>
            </div>
          </div>

          <fieldset disabled={fieldsDisabled} className="mb-6 min-w-0 border-0 p-0">
            <legend className="text-ink mb-3 block text-sm font-bold">Reply tone</legend>
            <div className="flex flex-col gap-3">
              {(
                [
                  ["friendly", "Friendly", "Warm and conversational"],
                  ["professional", "Professional", "Formal and concise"],
                  ["casual", "Casual", "Relaxed and informal"]
                ] as const
              ).map(([value, title, sub]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                    dmOwnerTone === value
                      ? "border-accent-purple/50 bg-accent-purple/10"
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
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

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
              className="input max-w-md disabled:cursor-not-allowed disabled:opacity-50"
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
