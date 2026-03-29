"use client";

import { Loader2, Mic, RotateCcw, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";

type Props = {
  clientId: string | null;
  disabled?: boolean;
  onScheduled?: () => void;
};

function formatMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function VoicePostButton({ clientId, disabled, onScheduled }: Props) {
  const v = useVoiceRecorder({ clientId, onScheduled });
  const [editCaption, setEditCaption] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const prevStatusRef = useRef(v.status);

  const barHeights = useMemo(() => {
    const base = v.audioLevel / 100;
    return [0.35, 0.55, 0.85, 0.55, 0.35].map((f, i) => `${12 + base * 36 * f * (1 + i * 0.08)}px`);
  }, [v.audioLevel]);

  useEffect(() => {
    if (v.status === "idle") {
      setEditCaption("");
      setEditTags("");
      setEditSchedule("");
    }
  }, [v.status]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = v.status;
    if (prev !== "preview" && v.status === "preview" && v.bundle) {
      setEditCaption(v.bundle.caption);
      setEditTags(v.bundle.hashtags.join(" "));
      setEditSchedule(toDatetimeLocalValue(v.bundle.suggestedTime));
    }
  }, [v.status, v.bundle]);

  const handleSave = () => {
    if (!v.bundle) return;
    const dt = new Date(editSchedule);
    if (Number.isNaN(dt.getTime())) {
      return;
    }
    const tags = editTags
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith("#") ? t : `#${t}`));
    void v.savePost({
      caption: editCaption,
      hashtags: tags,
      scheduledTimeIso: dt.toISOString(),
      platform: v.bundle.intent.platform
    });
  };

  if (!clientId) {
    return null;
  }

  return (
    <div className="mt-6 rounded-xl border border-subtle bg-surface/60 p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-ink font-display text-base font-bold tracking-tight">Voice to post</h3>
          <p className="text-muted mt-1 text-sm">
            Speak your idea — we transcribe, draft a caption, and schedule in one flow.
          </p>
        </div>
      </div>

      {v.status === "idle" && (
        <div className="flex flex-col items-center py-4">
          <button
            type="button"
            disabled={disabled}
            onClick={() => void v.startRecording()}
            className="group relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-subtle bg-surface shadow-glow transition-transform duration-300 hover:scale-[1.03] disabled:pointer-events-none disabled:opacity-40"
            aria-label="Start voice recording"
          >
            <span
              className="absolute inset-0 rounded-full border-2 border-accent-purple/40 opacity-70 animate-pulse group-hover:border-accent-teal/50"
              aria-hidden
            />
            <Mic className="text-accent-purple relative z-[1]" size={40} strokeWidth={2} aria-hidden />
          </button>
          <p className="text-muted mt-4 text-center text-sm">Tap to create post by voice</p>
          {disabled ? (
            <p className="text-warning mt-2 text-center text-xs">Connect a social account first.</p>
          ) : null}
        </div>
      )}

      {v.status === "recording" && (
        <div className="flex flex-col items-center py-4">
          <button
            type="button"
            onClick={() => v.stopRecording()}
            className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-danger bg-danger/15 shadow-[0_0_24px_rgba(255,77,109,0.35)] transition-transform active:scale-95"
            aria-label="Stop recording"
          >
            <Mic className="text-danger" size={40} strokeWidth={2} aria-hidden />
          </button>
          <div className="mt-4 flex h-10 items-end justify-center gap-1" aria-hidden>
            {barHeights.map((h, i) => (
              <span
                key={i}
                className="w-1.5 rounded-full bg-gradient-to-t from-accent-purple to-accent-teal transition-[height] duration-75"
                style={{ height: h }}
              />
            ))}
          </div>
          <p className="text-danger mt-3 text-sm font-semibold tabular-nums">
            {formatMmSs(v.elapsedSec)} / 0:30 · Tap to stop
          </p>
        </div>
      )}

      {v.status === "processing" && (
        <div className="flex flex-col items-center gap-4 py-10">
          <Loader2 className="text-accent-teal h-10 w-10 animate-spin" aria-hidden />
          <p className="text-ink text-center text-sm font-medium">{v.processingMessage}</p>
        </div>
      )}

      {v.status === "preview" && v.bundle && (
        <div className="space-y-4">
          <div className="rounded-lg border border-subtle bg-canvas/40 p-3 text-xs">
            <span className="text-muted">Heard: </span>
            <span className="text-ink">{v.transcript || "—"}</span>
          </div>
          <div>
            <label className="text-muted mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor="vp-caption">
              Caption
            </label>
            <textarea
              id="vp-caption"
              className="input min-h-[100px] resize-y"
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              maxLength={2200}
            />
          </div>
          <div>
            <label className="text-muted mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor="vp-tags">
              Hashtags
            </label>
            <input
              id="vp-tags"
              className="input"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="#fashion #india"
            />
          </div>
          <div>
            <label className="text-muted mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor="vp-when">
              Schedule
            </label>
            <input
              id="vp-when"
              className="input"
              type="datetime-local"
              value={editSchedule}
              onChange={(e) => setEditSchedule(e.target.value)}
            />
          </div>
          <p className="text-muted text-xs">
            Platform: <strong className="text-ink">{v.bundle.intent.platform}</strong> · Image idea:{" "}
            <span className="text-ink/90">{v.bundle.imagePrompt}</span>
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" className="button inline-flex items-center gap-2" onClick={() => void handleSave()}>
              <Send size={16} strokeWidth={2} aria-hidden />
              Schedule post
            </button>
            <button type="button" className="button secondary inline-flex items-center gap-2" onClick={() => v.reset()}>
              <RotateCcw size={16} strokeWidth={2} aria-hidden />
              Discard
            </button>
          </div>
        </div>
      )}

      {v.status === "error" && v.error && (
        <div className="py-4 text-center">
          <p className="text-error text-sm">{v.error}</p>
          <button type="button" className="button secondary mt-4 text-xs" onClick={() => v.reset()}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
