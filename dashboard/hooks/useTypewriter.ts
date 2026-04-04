"use client";

import { useEffect, useState } from "react";

export function useTypewriter(text: string, speed = 30): string {
  const [value, setValue] = useState(text);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setValue(text);
      return;
    }
    let index = 0;
    setValue("");
    const id = window.setInterval(() => {
      index += 1;
      setValue(text.slice(0, index));
      if (index >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [speed, text]);

  return value;
}
