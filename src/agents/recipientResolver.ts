export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/u.test(email);
}

export function extractEmailFromText(text: string): string | null {
  const match = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/u);
  return match ? match[0] : null;
}

export function resolveRecipient(options: {
  userEmail?: string;
  requestProvided?: string;
  contextExtracted?: string;
  fallback?: string;
}): string | null {
  if (options.requestProvided && isValidEmail(options.requestProvided)) return options.requestProvided;
  if (options.userEmail && isValidEmail(options.userEmail)) return options.userEmail;
  if (options.contextExtracted && isValidEmail(options.contextExtracted)) return options.contextExtracted;
  if (options.fallback && isValidEmail(options.fallback)) return options.fallback;
  return null;
}
