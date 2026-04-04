"use client";

import { I18nProvider } from "../context/i18n-context";
import { ToastProvider } from "../context/toast-context";

export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <I18nProvider>
      <ToastProvider>{children}</ToastProvider>
    </I18nProvider>
  );
}
