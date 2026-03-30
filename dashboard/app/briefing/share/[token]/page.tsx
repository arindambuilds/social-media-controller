"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { API_ORIGIN } from "../../../../lib/api";

type PublicBriefing = {
  id: string;
  content: string;
  tipText: string | null;
  sentAt: string;
  businessName: string;
  whatsappDelivered: boolean | null;
  emailDelivered: boolean | null;
};

export default function BriefingSharePage() {
  const params = useParams();
  const token = typeof params?.token === "string" ? decodeURIComponent(params.token) : "";
  const [briefing, setBriefing] = useState<PublicBriefing | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const res = await fetch(
          `${API_ORIGIN}/api/briefing/public/share/${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as {
          success?: boolean;
          briefing?: PublicBriefing;
          error?: { message?: string };
        };
        if (!res.ok) {
          setError(json.error?.message ?? "This link is not valid.");
          return;
        }
        if (json.briefing) setBriefing(json.briefing);
      } catch {
        setError("Could not load this page.");
      }
    })();
  }, [token]);

  if (error) {
    return (
      <div className="page-shell max-w-xl text-center">
        <p className="text-error">{error}</p>
        <p className="text-muted mt-4 text-sm">Shared links expire after 24 hours.</p>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="page-shell max-w-xl">
        <div className="skeleton h-10 w-2/3 rounded-lg" />
        <div className="skeleton mt-6 h-40 w-full rounded-xl" />
      </div>
    );
  }

  const tip = briefing.tipText ?? briefing.content.slice(0, 280);

  return (
    <div className="page-shell max-w-2xl">
      <p className="text-muted mb-2 text-sm">Shared briefing · {briefing.businessName}</p>
      <h1 className="text-ink font-display text-2xl font-bold">Morning briefing</h1>
      <p className="text-muted mt-1 text-sm">
        {new Date(briefing.sentAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
      </p>

      <blockquote className="border-accent-purple/50 bg-accent-purple/10 my-8 rounded-r-2xl border-l-4 py-4 pl-4">
        <p className="text-ink text-lg font-semibold leading-relaxed">{tip}</p>
      </blockquote>

      <article className="space-y-4">
        {briefing.content.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="text-ink text-base leading-relaxed">
            {para}
          </p>
        ))}
      </article>

      {/* Public Share Footer */}
      <div className="pb-8 text-center text-xs text-white/20 space-y-2 mt-10">
        <p>
          Powered by <span className="font-semibold text-cyan-400">Pulse</span> — AI growth intelligence for Instagram
        </p>
        <p>
          <a
            href="https://social-media-controller.vercel.app/onboarding"
            className="font-medium text-cyan-400 transition hover:text-cyan-300"
          >
            Get your free AI report →
          </a>
        </p>
        <p className="text-white/10">This report was generated automatically by Claude AI</p>
      </div>
    </div>
  );
}
