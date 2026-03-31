import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { PerplexityQuestion, PipelineConfig, StageResult } from "../types/pipeline";
import { QUADRAPILOT_ROOT } from "../lib/paths";

const SYSTEM = `You are the architect of PulseOS, an AI social media copilot for Indian MSMEs built on Node.js/TypeScript/BullMQ/Prisma/Supabase.
Given a development goal, generate exactly 3-5 focused technical research questions for Perplexity. Each question must include:
- A specific version pin (e.g. BullMQ 5.x)
- The exact technical pattern needed
- Why this matters for production reliability
Respond with ONLY a valid JSON array of objects with keys: id (number 1..n), question (string), versionPin (string), context (string). No markdown fences.`;

function extractJsonArray(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = fence ? fence[1]!.trim() : trimmed;
  return JSON.parse(payload) as unknown;
}

function normalizeQuestions(raw: unknown): PerplexityQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, i) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const question = String(o.question ?? "");
      if (!question) return null;
      return {
        id: typeof o.id === "number" ? o.id : i + 1,
        question,
        versionPin: String(o.versionPin ?? "n/a"),
        context: String(o.context ?? "")
      } as PerplexityQuestion;
    })
    .filter((q): q is PerplexityQuestion => q != null)
    .slice(0, 5);
}

async function loadTemplateQuestions(): Promise<PerplexityQuestion[]> {
  const p = path.join(QUADRAPILOT_ROOT, "templates", "researchQuestions.txt");
  const txt = await fs.readFile(p, "utf8");
  const arr = extractJsonArray(txt) as unknown;
  return normalizeQuestions(arr).length > 0 ? normalizeQuestions(arr) : [];
}

export async function runClaudeStage(config: PipelineConfig): Promise<StageResult> {
  const t0 = Date.now();
  const ts = new Date().toISOString();
  const questionsPath = path.join(
    config.outputDir,
    `cycle-${config.cycleNumber}-questions.json`
  );
  await fs.mkdir(config.outputDir, { recursive: true });

  let questions: PerplexityQuestion[] = [];
  let output = "";

  try {
    if (!config.claudeApiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY (or CLAUDE_API_KEY)");
    }
    const client = new Anthropic({ apiKey: config.claudeApiKey });
    const msg = await client.messages.create({
      model: config.claudeModel,
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: "user", content: config.goal }]
    });
    const block = msg.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text : "";
    const parsed = extractJsonArray(text);
    questions = normalizeQuestions(parsed);
    if (questions.length < 3) {
      throw new Error("Too few questions from Claude");
    }
    output = JSON.stringify(questions, null, 2);
    await fs.writeFile(questionsPath, output, "utf8");
    return {
      stage: "Claude — research questions",
      success: true,
      output: questionsPath,
      duration: Date.now() - t0,
      timestamp: ts
    };
  } catch (e) {
    console.warn("⚠️  Claude stage fallback to template:", e instanceof Error ? e.message : e);
    questions = await loadTemplateQuestions();
    if (questions.length === 0) {
      questions = [
        {
          id: 1,
          question: `Production patterns for implementing: ${config.goal}`,
          versionPin: "Node.js LTS",
          context: "Fallback when API and template fail."
        }
      ];
    }
    output = JSON.stringify(questions, null, 2);
    await fs.writeFile(questionsPath, output, "utf8");
    return {
      stage: "Claude — research questions",
      success: true,
      output: questionsPath,
      duration: Date.now() - t0,
      timestamp: ts,
      error: `fallback_used: ${e instanceof Error ? e.message : String(e)}`
    };
  }
}
