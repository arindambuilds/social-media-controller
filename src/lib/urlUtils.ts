import net from "net";

const SAFE_LOGO_UPLOAD_PATH = /^\/uploads\/logos\/[A-Za-z0-9._-]+$/;

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  );
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;

  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return net.isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
  }

  return (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

export function isSafeUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (SAFE_LOGO_UPLOAD_PATH.test(trimmed)) return true;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (!parsed.hostname) return false;
  if (isBlockedHostname(parsed.hostname)) return false;

  const ipVersion = net.isIP(parsed.hostname);
  if (ipVersion === 4) return !isPrivateIpv4(parsed.hostname);
  if (ipVersion === 6) return !isPrivateIpv6(parsed.hostname);

  return true;
}

export function sanitizeLogoUrl(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return isSafeUrl(trimmed) ? trimmed : null;
}

export function validateLogoUrlInput(
  input: string | null | undefined
): { valid: true; normalized: string | null } | { valid: false; error: string } {
  if (input === undefined) return { valid: true, normalized: null };
  if (input === null) return { valid: true, normalized: null };

  const trimmed = input.trim();
  if (!trimmed) return { valid: true, normalized: null };
  if (isSafeUrl(trimmed)) return { valid: true, normalized: trimmed };

  return {
    valid: false,
    error:
      "logoUrl must be either a safe /uploads/logos path or a public HTTPS URL. Private, localhost, and internal network targets are not allowed."
  };
}
