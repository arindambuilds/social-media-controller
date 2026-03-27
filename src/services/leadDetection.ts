const leadKeywords = ["price", "pricing", "interested", "dm me", "quote", "cost"];

export function detectLeadIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  return leadKeywords.some((keyword) => normalized.includes(keyword));
}
