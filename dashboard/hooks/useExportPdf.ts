"use client";

import { useCallback, useState } from "react";
import { API_URL } from "../lib/api";
import { getStoredToken } from "../lib/auth-storage";

type ExportReportType = "briefing" | "analytics";

export function useExportPdf() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clearError = useCallback(() => setError(""), []);

  const exportPdf = useCallback(async (clientId: string, reportType?: ExportReportType): Promise<boolean> => {
    if (!clientId || loading) return false;
    setLoading(true);
    setError("");
    try {
      const token = getStoredToken();
      if (!token) {
        setError("Please log in again.");
        return false;
      }
      const res = await fetch(`${API_URL}/reports/${encodeURIComponent(clientId)}/export/pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(reportType ? { reportType } : {})
      });

      if (!res.ok) {
        let message = "Could not export PDF. Please try again.";
        try {
          const body = (await res.json()) as { error?: string };
          if (typeof body.error === "string" && body.error.trim()) message = body.error;
        } catch {
          // ignore non-json errors
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `report-${clientId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not export PDF. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return { exportPdf, loading, error, clearError };
}

