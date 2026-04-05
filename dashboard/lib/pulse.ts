export type PlanTier = "free" | "starter" | "growth" | "agency" | "pioneer" | "pro";

export function formatPlanLabel(plan?: string | null): string {
  switch ((plan ?? "starter").toLowerCase()) {
    case "free":
      return "Starter";
    case "starter":
      return "Starter";
    case "growth":
      return "Growth";
    case "agency":
      return "Pro";
    case "pioneer":
      return "Pioneer";
    case "pro":
      return "Pro";
    default:
      return "Starter";
  }
}

export function routeTitle(pathname: string): string {
  if (pathname.startsWith("/conversations")) return "Conversations";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/billing")) return "Billing";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/accounts")) return "Accounts";
  if (pathname.startsWith("/analytics")) return "Analytics";
  if (pathname.startsWith("/insights")) return "Insights";
  if (pathname.startsWith("/leads")) return "Leads";
  return "PulseOS";
}

export function buildDocumentTitle(title: string): string {
  return `${title} — PulseOS`;
}

export function getGreeting(name?: string | null, now = new Date()): string {
  const hour = now.getHours();
  const first = (name ?? "there").trim().split(/\s+/)[0] ?? "there";
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

export function getInitials(name?: string | null, fallback = "PO"): string {
  const raw = name?.trim();
  if (!raw) return fallback;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function formatRelativeTime(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatCompactTime(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit"
  });
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

export function minutesAgoLabel(lastUpdatedAt: number): string {
  const diff = Math.max(0, Math.round((Date.now() - lastUpdatedAt) / 60000));
  if (diff <= 1) return "Last updated just now";
  return `Last updated ${diff} min ago`;
}

export function hashColor(seed: string): string {
  const palette = ["#F6D99D", "#D6E4FF", "#DDF5E5", "#F7D8D8", "#E4D9F8", "#FFE7BF"];
  const hash = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length] ?? palette[0]!;
}

export function clampPercentage(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
