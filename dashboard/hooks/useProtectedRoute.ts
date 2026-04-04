"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth-context";

export function useProtectedRoute() {
  const router = useRouter();
  const { token, isReady, user, userLoading, refreshUser } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!token) {
      router.replace("/login");
    }
  }, [isReady, token, router]);

  return {
    token,
    isReady,
    user,
    userLoading,
    isAuthenticated: Boolean(token),
    refreshUser
  };
}
