"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { cn } from "../../lib/cn";

interface DemoBannerProps {
  onDismiss?: () => void;
  className?: string;
}

export function DemoBanner({ onDismiss, className }: DemoBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  return (
    <div className={cn(
      "bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start justify-between",
      className
    )}>
      <div className="flex-1">
        <h3 className="text-amber-800 font-medium mb-1">Demo Mode Active</h3>
        <p className="text-amber-700 text-sm mb-3">
          You&apos;re currently viewing demo data. Connect your WhatsApp number in settings to start receiving real messages and see your actual performance metrics.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="border-amber-300 text-amber-700 hover:bg-amber-100"
          onClick={() => window.location.href = "/settings"}
        >
          Connect WhatsApp
        </Button>
      </div>
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="text-amber-500 hover:text-amber-700 ml-4 flex-shrink-0"
          aria-label="Dismiss demo banner"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
