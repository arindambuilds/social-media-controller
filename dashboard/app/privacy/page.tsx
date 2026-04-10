import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — PulseOS",
  description: "How PulseOS collects, uses, and protects your data."
};

const LAST_UPDATED = "April 11, 2026";
const CONTACT_EMAIL = "privacy@pulseos.in";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-white/80">
      <h1 className="font-display mb-2 text-3xl font-bold text-white">Privacy Policy</h1>
      <p className="mb-10 text-sm text-white/40">Last updated: {LAST_UPDATED}</p>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">1. Who we are</h2>
        <p>
          PulseOS (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is an AI-powered social media
          copilot for Instagram creators and small businesses in India. This policy explains how we
          collect, use, and protect your personal data when you use our platform.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">2. Data we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account information: name, email address, business name, business type.</li>
          <li>Instagram data: posts, engagement metrics, follower counts, DM conversations — fetched via the Meta Graph API with your explicit OAuth consent.</li>
          <li>WhatsApp data: inbound messages and outbound replies processed via the WhatsApp Business API (Meta).</li>
          <li>Usage data: pages visited, features used, timestamps — for product improvement.</li>
          <li>Payment data: Razorpay order IDs and payment IDs. We do not store card numbers or bank details.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">3. Third-party services</h2>
        <p className="mb-3">We share data with the following processors to operate the service:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-white">Meta (Facebook/Instagram/WhatsApp)</strong> — social data ingestion and WhatsApp Business API messaging.</li>
          <li><strong className="text-white">Supabase</strong> — PostgreSQL database hosting. Data is stored in the EU (Frankfurt) region.</li>
          <li><strong className="text-white">OpenAI</strong> — AI caption and insight generation. Prompts may include post content and engagement data.</li>
          <li><strong className="text-white">Anthropic</strong> — AI briefing and DM reply generation.</li>
          <li><strong className="text-white">Upstash (Redis)</strong> — job queues, rate limiting, session caching.</li>
          <li><strong className="text-white">Render</strong> — API server hosting (US region).</li>
          <li><strong className="text-white">Vercel</strong> — dashboard hosting (Edge Network).</li>
          <li><strong className="text-white">Sentry</strong> — error monitoring. Stack traces and request metadata are sent on errors.</li>
          <li><strong className="text-white">Razorpay</strong> — payment processing for Indian users.</li>
          <li><strong className="text-white">Postmark</strong> — transactional email delivery.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">4. How we use your data</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>To provide the service: analytics, briefings, AI replies, reports.</li>
          <li>To send you daily briefings and notifications you have opted into.</li>
          <li>To improve the product through aggregated, anonymised usage analysis.</li>
          <li>To comply with legal obligations.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">5. Data retention</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account data is retained while your account is active.</li>
          <li>Instagram post and engagement data: retained for 12 months from ingestion.</li>
          <li>WhatsApp message data: retained for 90 days.</li>
          <li>Email logs: retained for 90 days.</li>
          <li>Audit logs: retained for 12 months.</li>
          <li>On account deletion, all personal data is permanently erased within 30 days.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">6. Your rights (GDPR / Indian IT Act)</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-white">Access:</strong> request a copy of all data we hold about you.</li>
          <li><strong className="text-white">Erasure:</strong> delete your account and all associated data from Settings → Delete Account.</li>
          <li><strong className="text-white">Portability:</strong> export your conversation history from Settings → Export Data.</li>
          <li><strong className="text-white">Correction:</strong> update your account details at any time from Settings.</li>
          <li><strong className="text-white">Objection:</strong> opt out of AI processing by disabling auto-reply in DM Settings.</li>
        </ul>
        <p className="mt-3">
          To exercise any right, email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan-400 underline">
            {CONTACT_EMAIL}
          </a>
          . We will respond within 30 days.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">7. WhatsApp opt-in consent</h2>
        <p>
          We only send automated WhatsApp messages to contacts who have initiated a conversation with
          your business number. We do not send unsolicited messages. Users can opt out by replying
          &ldquo;STOP&rdquo; at any time.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">8. Security</h2>
        <p>
          We use HTTPS/TLS for all data in transit, AES-256 encryption for stored OAuth tokens,
          bcrypt (cost 12) for passwords, and HttpOnly cookies for session management. Access tokens
          expire after 15 minutes.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">9. Contact</h2>
        <p>
          Questions about this policy? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan-400 underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <div className="border-t border-white/10 pt-6 text-sm text-white/40">
        <Link href="/terms" className="text-cyan-400 underline">Terms of Service</Link>
        {" · "}
        <Link href="/" className="hover:text-white/60">Back to PulseOS</Link>
      </div>
    </main>
  );
}
