import { Router } from "express";
import type { Request, Response } from "express";
import { runOrchestrator } from "../agents/orchestrator";

type ExecuteBody = { input?: string };

export const executeRouter = Router();

executeRouter.post("/", async (req: Request<unknown, unknown, ExecuteBody>, res: Response) => {
  try {
    const input = typeof req.body?.input === "string" ? req.body.input.trim() : "";
    if (!input) {
      res.status(400).json({ error: "input is required" });
      return;
    }

    const { output, metadata } = await runOrchestrator(input);
    res.json({ reply: output, metadata });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

