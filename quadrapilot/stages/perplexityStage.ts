import fs from "node:fs/promises";
import path from "node:path";
import type { PerplexityAnswer, PerplexityQuestion, PipelineConfig, StageResult } from "../types/pipeline";

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";
const MODEL = "llama-3.1-sonar-large-128k-online";

const SYSTEM = `You are a technical researcher.
Answer with exactly these sections (use these headings):
Pattern: <one line>
Snippet:
\`\`\`typescript
<code>
\`\`\`
Gotcha: <one line>
Sources: <comma-separated URLs or "n/a">

Be specific. Include version numbers. Focus on production patterns only.`;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseAnswerMarkdown(raw: string, questionId: number): PerplexityAnswer {
  const pattern =
    raw.match(/(?:^|\n)Pattern:\s*(.+?)(?:\n|$)/i)?.[1]?.trim() || "(see body)";
  const gotcha = raw.match(/Gotcha:\s*(.+?)(?:\n|$)/is)?.[1]?.trim() || "—";
  const snippetMatch = raw.match(/```(?:typescript|ts)?\s*([\s\S]*?)```/i);
  const snippet = snippetMatch ? snippetMatch[1]!.trim() : "// (no fenced snippet)";
  const sourcesLine = raw.match(/Sources:\s*(.+?)(?:\n\n|\n*$)/is)?.[1]?.trim() || "";
  const sources = sourcesLine
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    questionId,
    pattern,
    snippet,
    gotcha,
    sources: sources.length ? sources : ["n/a"]
  };
}

async function callPerplexity(apiKey: string, userContent: string, retry429: boolean): Promise<string> {
  const res = await fetch(PERPLEXITY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userContent }
      ],
      temperature: 0.2
    })
  });

  if (res.status === 429 && retry429) {
    await sleep(3000);
    return callPerplexity(apiKey, userContent, false);
  }

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Perplexity HTTP ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty Perplexity response");
  return typeof content === "string" ? content : JSON.stringify(content);
}

export async function runPerplexityStage(
  config: PipelineConfig,
  questions: PerplexityQuestion[]
): Promise<StageResult> {
  const t0 = Date.now();
  const ts = new Date().toISOString();
  const outMd = path.join(config.outputDir, `cycle-${config.cycleNumber}-research.md`);
  await fs.mkdir(config.outputDir, { recursive: true });

  const lines: string[] = [`# Cycle ${config.cycleNumber} — Perplexity Research`, ""];

  if (!config.perplexityApiKey) {
    lines.push("_Perplexity API key missing — skipped remote calls._", "");
    for (const q of questions) {
      lines.push(`## Question ${q.id}: ${q.question}`, "");
      lines.push("**Pattern:** _(skipped — set PERPLEXITY_API_KEY)_", "");
      lines.push("**Snippet:**", "```typescript", "// configure PERPLEXITY_API_KEY", "```", "");
      lines.push("**Gotcha:** n/a", "", "---", "");
    }
    await fs.writeFile(outMd, lines.join("\n"), "utf8");
    return {
      stage: "Perplexity — research",
      success: true,
      output: outMd,
      duration: Date.now() - t0,
      timestamp: ts,
      error: "perplexity_skipped_no_key"
    };
  }

  let anyFail = false;
  for (const q of questions) {
    console.log(`⏳ Perplexity Q${q.id}/${questions.length}…`);
    try {
      const userMsg = `[${q.versionPin}] ${q.question}\n\nContext: ${q.context}`;
      const raw = await callPerplexity(config.perplexityApiKey, userMsg, true);
      const ans = parseAnswerMarkdown(raw, q.id);
      lines.push(`## Question ${q.id}: ${q.question}`, "");
      lines.push(`**Pattern:** ${ans.pattern}`, "");
      lines.push("**Snippet:**", "```typescript", ans.snippet, "```", "");
      lines.push(`**Gotcha:** ${ans.gotcha}`, "");
      if (ans.sources.length) lines.push(`**Sources:** ${ans.sources.join(", ")}`, "");
      lines.push("", "---", "");
      console.log(`✅ Perplexity Q${q.id} — ok`);
    } catch (e) {
      anyFail = true;
      const msg = e instanceof Error ? e.message : String(e);
      lines.push(`## Question ${q.id}: ${q.question}`, "");
      lines.push(`**Error:** ${msg}`, "", "---", "");
      console.log(`⚠️  Perplexity Q${q.id} — ${msg}`);
    }
    await sleep(2000);
  }

  await fs.writeFile(outMd, lines.join("\n"), "utf8");
  return {
    stage: "Perplexity — research",
    success: !anyFail,
    output: outMd,
    duration: Date.now() - t0,
    timestamp: ts,
    error: anyFail ? "one_or_more_questions_failed" : undefined
  };
}
