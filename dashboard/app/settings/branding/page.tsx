"use client";

/** page-enter: `usePageEnter` + `key={pathname}` on the root wrapper. */

import { usePathname } from "next/navigation";
import { usePageEnter } from "@/hooks/usePageEnter";
import { BrandingSettings } from "../../../components/settings/BrandingSettings";

export default function BrandingPage() {
  const pathname = usePathname();
  const pageClassName = usePageEnter();
  return (
    <div key={pathname} className={`max-w-5xl space-y-6 p-6 md:p-8 ${pageClassName}`}>
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Brand settings</h1>
        <p className="mt-1 text-sm text-white/40">Customise how your agency appears on exported PDF reports.</p>
      </div>
      <div className="gradient-border p-6">
        <BrandingSettings />
      </div>
    </div>
  );
}
