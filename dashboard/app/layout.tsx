import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  themeColor: "#0A0A0F"
};

const THEME_BOOTSTRAP = `!(function(){try{var k='smc_theme',s=localStorage.getItem(k),h=document.documentElement;if(s==='light'){h.classList.remove('dark');h.dataset.theme='light';}else{h.classList.add('dark');h.dataset.theme='dark';}}catch(_){document.documentElement.classList.add('dark');document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} bg-canvas`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased" suppressHydrationWarning>
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
