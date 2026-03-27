import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import { AppProviders } from "../components/app-providers";
import { DashboardNav } from "../components/dashboard-nav";
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
    <html lang="en" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
      <body>
        <AppProviders>
          <DashboardNav />
          <main className="app-main">{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
