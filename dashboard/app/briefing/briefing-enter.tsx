"use client";

import { usePathname } from "next/navigation";
import { usePageEnter } from "@/hooks/usePageEnter";

/** Single `page-enter` boundary for all `/briefing/*` routes (layout). */
export function BriefingEnter({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const pageClassName = usePageEnter();
  return (
    <div key={pathname} className={pageClassName}>
      {children}
    </div>
  );
}
