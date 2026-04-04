import { apiFetch, apiFetchFormData, apiFetchResponse } from "./api";

export type WorkspaceMe = {
  success: boolean;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    clientId: string | null;
    plan?: string | null;
  };
  instagramConnected: boolean;
  plan?: string;
};

export type AgencyUsage = {
  plan: string;
  usage: {
    briefings: { used: number; limit: number | null };
    reportExports: { used: number; limit: number | null };
    voiceGenerations: { used: number; limit: number | null };
    scheduledReports: { used: number; limit: number | null };
    clients: { used: number; limit: number | null };
  };
};

export type ConversationSummary = {
  id: string;
  contactName: string | null;
  instagramUserId: string;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
  resolved: boolean;
};

export type ConversationMessage = {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  sentAt: string;
  isAutoReply?: boolean;
  confidenceScore?: number | null;
};

export type ClientProfile = {
  id: string;
  name: string;
  preferredInstagramHandle: string | null;
  briefingHourIst: number | null;
  whatsappNumber: string | null;
  language: "en" | "or" | null;
  businessType: string | null;
};

export type DmSettings = {
  id: string;
  dmAutoReplyEnabled: boolean;
  dmBusinessContext: string | null;
  dmOwnerTone: string | null;
  whatsappNumber: string | null;
};

export type BrandingSettings = {
  agencyName: string;
  brandColor: string;
  logoUrl: string | null;
};

export type BillingStatus = {
  success: true;
  generationsUsed: number;
  generationsLimit: number;
};

export async function getAgencyUsage(): Promise<AgencyUsage> {
  return apiFetch<AgencyUsage>("/agency/usage");
}

export async function getConversations(clientId: string): Promise<ConversationSummary[]> {
  return apiFetch<ConversationSummary[]>(`/clients/${encodeURIComponent(clientId)}/dm-conversations`);
}

export async function getConversationMessages(clientId: string, conversationId: string): Promise<ConversationMessage[]> {
  return apiFetch<ConversationMessage[]>(`/clients/${encodeURIComponent(clientId)}/dm-conversations/${encodeURIComponent(conversationId)}/messages`);
}

export async function getClientProfile(clientId: string): Promise<ClientProfile> {
  const response = await apiFetch<{ success: boolean; client: ClientProfile }>(`/clients/${encodeURIComponent(clientId)}/profile`);
  return response.client;
}

export async function updateClientProfile(clientId: string, payload: Partial<ClientProfile>): Promise<ClientProfile> {
  const response = await apiFetch<{ success: boolean; client: ClientProfile }>(`/clients/${encodeURIComponent(clientId)}/profile`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  return response.client;
}

export async function getDmSettings(clientId: string): Promise<DmSettings> {
  const response = await apiFetch<{ success: boolean; client: DmSettings }>(`/clients/${encodeURIComponent(clientId)}/dm-settings`);
  return response.client;
}

export async function updateDmSettings(clientId: string, payload: Partial<DmSettings>): Promise<DmSettings> {
  const response = await apiFetch<{ success: boolean; client: DmSettings }>(`/clients/${encodeURIComponent(clientId)}/dm-settings`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  return response.client;
}

export async function getBranding(): Promise<BrandingSettings> {
  return apiFetch<BrandingSettings>("/agency/branding");
}

export async function saveBranding(payload: Partial<BrandingSettings>): Promise<void> {
  await apiFetch("/agency/branding", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function uploadBrandLogo(formData: FormData): Promise<{ url: string }> {
  return apiFetchFormData<{ url: string }>("/agency/branding/logo", formData);
}

export async function updateAccount(payload: { name?: string | null; email?: string | null }): Promise<WorkspaceMe["user"]> {
  const response = await apiFetch<{ success: boolean; user: WorkspaceMe["user"] }>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  return response.user;
}

export async function getBillingStatus(clientId: string): Promise<BillingStatus> {
  return apiFetch<BillingStatus>(`/billing/${encodeURIComponent(clientId)}/status`);
}

export async function startCheckout(planId: "starter" | "growth" | "agency" | "pioneer"): Promise<{ url?: string }> {
  return apiFetch<{ url?: string }>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ planId })
  });
}

export async function openBillingPortal(): Promise<{ url?: string }> {
  return apiFetch<{ url?: string }>("/billing/portal", { method: "POST" });
}

export async function exportReportPdf(clientId: string): Promise<Blob> {
  const response = await apiFetchResponse(`/reports/${encodeURIComponent(clientId)}/export/pdf`, {
    method: "POST",
    body: JSON.stringify({ reportType: "analytics" })
  });
  if (!response.ok) {
    throw new Error("Couldn’t download the PDF just yet.");
  }
  return response.blob();
}
