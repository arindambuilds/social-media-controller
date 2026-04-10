import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — PulseOS",
  description: "Terms governing your use of PulseOS."
};

const LAST_UPDATED = "April 11, 2026";
const CONTACT_EMAIL = "legal@pulseos.in";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-white/80">
      <h1 className="font-display mb-2 text-3xl font-bold text-white">Terms of Service</h1>
      <p className="mb-10 text-sm text-white/40">Last updated: {LAST_UPDATED}</p>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">1. Acceptance</h2>
        <p>
          By creating an account or using PulseOS, you agree to these Terms. If you do not agree,
          do not use the service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">2. Description of service</h2>
        <p>
          PulseOS provides AI-powered analytics, briefings, WhatsApp automation, and content tools
          for Instagram creators and small businesses. Features vary by plan.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">3. Accounts</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>You must be at least 18 years old to create an account.</li>
          <li>You are responsible for keeping your credentials secure.</li>
          <li>One account per person or business entity unless you have an agency plan.</li>
          <li>We may suspend accounts that violate these Terms without notice.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">4. Acceptable use</h2>
        <p className="mb-3">You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Use PulseOS to send spam, unsolicited messages, or harass users.</li>
          <li>Violate Meta&apos;s WhatsApp Business Policy or Instagram Platform Policy.</li>
          <li>Reverse-engineer, scrape, or attempt to extract our source code or data.</li>
          <li>Use the service for any illegal purpose under Indian law or applicable international law.</li>
          <li>Impersonate another person or business.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">5. WhatsApp Business Policy compliance</h2>
        <p>
          You are solely responsible for ensuring your use of WhatsApp automation complies with
          Meta&apos;s WhatsApp Business Policy. You must obtain opt-in consent from contacts before
          sending automated messages. PulseOS displays a &ldquo;Powered by WhatsApp Business API&rdquo;
          disclosure where required by Meta.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">6. Billing</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Paid plans are billed monthly or annually via Razorpay.</li>
          <li>All prices are in INR and inclusive of applicable taxes.</li>
          <li>You may cancel at any time. No refunds for partial billing periods unless required by law.</li>
          <li>We reserve the right to change pricing with 30 days&apos; notice.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">7. Intellectual property</h2>
        <p>
          PulseOS and its original content, features, and functionality are owned by us and protected
          by copyright. Your data remains yours. You grant us a limited licence to process your data
          solely to provide the service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">8. Disclaimers and limitation of liability</h2>
        <p className="mb-3">
          The service is provided &ldquo;as is&rdquo; without warranties of any kind. We do not guarantee
          uptime, accuracy of AI-generated content, or specific business outcomes.
        </p>
        <p>
          To the maximum extent permitted by law, our total liability to you for any claim arising
          from use of the service is limited to the amount you paid us in the 3 months preceding
          the claim.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">9. Termination</h2>
        <p>
          You may delete your account at any time from Settings. We may terminate or suspend your
          account for violations of these Terms. On termination, your data will be deleted per our
          Privacy Policy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">10. Governing law</h2>
        <p>
          These Terms are governed by the laws of India. Any disputes shall be subject to the
          exclusive jurisdiction of courts in Bengaluru, Karnataka.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">11. Contact</h2>
        <p>
          Questions?{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan-400 underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>

      <div className="border-t border-white/10 pt-6 text-sm text-white/40">
        <Link href="/privacy" className="text-cyan-400 underline">Privacy Policy</Link>
        {" · "}
        <Link href="/" className="hover:text-white/60">Back to PulseOS</Link>
      </div>
    </main>
  );
}
