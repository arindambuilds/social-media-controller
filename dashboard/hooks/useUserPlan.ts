import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export type UserPlan = "free" | "starter" | "growth" | "agency";

type MeResponse = {
  success?: boolean;
  plan?: UserPlan;
};

export function useUserPlan(): UserPlan {
  const [plan, setPlan] = useState<UserPlan>("free");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<MeResponse>("/auth/me");
        if (!cancelled && res.plan) {
          setPlan(res.plan);
        }
      } catch {
        // ignore – default "free" is fine
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return plan;
}

