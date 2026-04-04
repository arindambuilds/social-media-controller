"use client";

import { getSessionId } from "../utils/analytics";

const EXP_PREFIX = "pulse.experiment.";

const experimentMemory = new Map<string, string>();

function safeGet(key: string): string | null {
  return experimentMemory.get(key) ?? null;
}

function safeSet(key: string, value: string): void {
  experimentMemory.set(key, value);
}

function hashToBucket(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getStoredExperimentVariant(experimentName: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = safeGet(`${EXP_PREFIX}${experimentName}`);
  return raw && raw.trim() ? raw : null;
}

export function getExperimentVariant(experimentName: string): string {
  return getExperimentVariantFromChoices(experimentName, ["A", "B"]);
}

export function getExperimentVariantFromChoices(experimentName: string, choices: string[]): string {
  if (typeof window === "undefined") return choices[0] ?? "A";
  const normalizedChoices = choices.filter((x) => x.trim().length > 0);
  if (!normalizedChoices.length) return "A";
  const existing = getStoredExperimentVariant(experimentName);
  if (existing && normalizedChoices.includes(existing)) return existing;
  const sessionId = getSessionId();
  const bucket = hashToBucket(`${experimentName}:${sessionId}`);
  const variant = normalizedChoices[bucket % normalizedChoices.length]!;
  safeSet(`${EXP_PREFIX}${experimentName}`, variant);
  return variant;
}
