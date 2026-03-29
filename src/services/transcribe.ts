import OpenAI from "openai";
import { toFile } from "openai/uploads";

/**
 * Transcribe short voice clips with OpenAI Whisper (Hindi + English code-switching).
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Voice transcription is not configured (OPENAI_API_KEY missing).");
  }

  const openai = new OpenAI({ apiKey });
  const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "audio";
  const file = await toFile(audioBuffer, `recording.${ext}`, { type: mimeType || "audio/webm" });

  const res = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "hi"
  });

  const text = typeof res === "string" ? res : (res as { text?: string }).text;
  if (!text?.trim()) {
    throw new Error("Whisper returned an empty transcript.");
  }
  return text.trim();
}
