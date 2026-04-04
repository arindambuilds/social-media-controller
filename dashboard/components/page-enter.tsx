"use client";

/** page-enter: shared client shell for staggered reveal (see `usePageEnter`). */
import { usePathname } from "next/navigation";
import { usePageEnter } from "@/hooks/usePageEnter";

/** Client wrapper for server pages (or any tree) that need `page-enter` + route-key remount. */
export function PageEnterShell({
  children,
  className
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  const pathname = usePathname();
  const pageClassName = usePageEnter();
  return (
    <div key={pathname} className={[pageClassName, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
