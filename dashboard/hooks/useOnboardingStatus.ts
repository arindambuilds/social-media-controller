"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "../lib/auth-storage";

export interface OnboardingStatus {
  onboardingCompleted: boolean;
  onboardingStep: number;
  hasDemoData: boolean;
  businessType?: string;
  businessName?: string;
}

export function useOnboardingStatus() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getAccessToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/auth/onboarding-status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch onboarding status");
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return {
    status,
    loading,
    error,
    refetch: fetchStatus,
  };
}