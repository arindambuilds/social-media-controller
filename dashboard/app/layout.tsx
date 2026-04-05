import type { Metadata, Viewport } from "next";
import { DM_Sans, Sora } from "next/font/google";
import { AppProviders } from "../components/app-providers";
import { AppFrame } from "../components/layout/app-frame";
import { AuthProvider } from "../context/auth-context";
import { DemoModeProvider } from "../context/demo-mode-context";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"]
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: "PulseOS — AI-powered social media copilot for Instagram creators and small businesses",
  description: "PulseOS handles Instagram content, analytics, WhatsApp automation, and growth for creators and small businesses in India.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#0D1B3E"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sora.variable} ${dmSans.variable}`}>
      <body className="pulse-root">
        <AppProviders>
          <DemoModeProvider>
            <AuthProvider>
              <AppFrame>{children}</AppFrame>
            </AuthProvider>
          </DemoModeProvider>
        </AppProviders>
      </body>
    </html>
  );
}
