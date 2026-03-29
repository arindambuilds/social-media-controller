import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import { AppProviders } from "../components/app-providers";
import { AuthReadyGate } from "../components/auth-ready-gate";
import { AuthProvider } from "../context/auth-context";
import { DemoModeProvider } from "../context/demo-mode-context";
import { DashboardNav } from "../components/dashboard-nav";
import { DemoModeBanner } from "../components/demo-mode-banner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Pulse — Instagram growth copilot",
  description:
    "Analytics, AI insights, and captions for local businesses and creators — Instagram-first, pilot-ready."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${sora.variable} bg-canvas`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <AppProviders>
          <DemoModeProvider>
            <AuthProvider>
              <DemoModeBanner />
              <DashboardNav />
              <AuthReadyGate>
                {/* Errors in route segments are caught by app/error.tsx (Next.js error boundary). */}
                <main className="app-main">{children}</main>
              </AuthReadyGate>
            </AuthProvider>
          </DemoModeProvider>
        </AppProviders>
      </body>
    </html>
  );
}
