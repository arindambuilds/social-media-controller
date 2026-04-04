"use client";

import { useEffect } from "react";
import { buildDocumentTitle } from "../lib/pulse";

export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = buildDocumentTitle(title);
  }, [title]);
}
