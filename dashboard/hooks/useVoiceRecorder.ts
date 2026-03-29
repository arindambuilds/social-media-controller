"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiFetchFormData } from "../lib/api";

export type VoiceStatus = "idle" | "recording" | "processing" | "preview" | "error";

export type VoiceIntentShape = {
  topic: string;
  platform: "instagram" | "facebook" | "both";
  scheduledTime: string;
  tone: string;
  language: string;
  rawTranscript: string;
};

export type VoiceGenerateResult = {
  intent: VoiceIntentShape;
  caption: string;
  hashtags: string[];
  imagePrompt: string;
  suggestedTime: string;
};

const MAX_MS = 30_000;
const PROCESSING_MESSAGES: string[] = [
  "Transcribing your voice…",
  "Understanding what you want…",
  "Writing your caption…"
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return "audio/webm";
}

export function useVoiceRecorder(options: {
  clientId: string | null;
  onScheduled?: () => void;
}) {
  const { clientId, onScheduled } = options;
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [bundle, setBundle] = useState<VoiceGenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [processingMessage, setProcessingMessage] = useState(PROCESSING_MESSAGES[0]);
  const [elapsedSec, setElapsedSec] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stopAnalyser = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    stopAnalyser();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, [stopAnalyser]);

  useEffect(() => {
    return () => {
      stopStream();
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [stopStream]);

  const startRecording = useCallback(async () => {
    if (!clientId || typeof window === "undefined") {
      setError("Select a client context first.");
      setStatus("error");
      return;
    }
    setError(null);
    setBundle(null);
    setTranscript("");
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i]!;
        const avg = sum / data.length / 255;
        setAudioLevel(Math.min(100, Math.round(avg * 140)));
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(250);
      setStatus("recording");
      setElapsedSec(0);
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);

      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      maxTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, MAX_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone access denied.");
      setStatus("error");
      stopStream();
    }
  }, [clientId, stopStream]);

  const sendToBackend = useCallback(
    async (blob: Blob) => {
      if (!clientId) return;
      setStatus("processing");
      setProcessingMessage(PROCESSING_MESSAGES[0]);
      let msgIdx = 0;
      const msgTimer = setInterval(() => {
        msgIdx = (msgIdx + 1) % PROCESSING_MESSAGES.length;
        setProcessingMessage(PROCESSING_MESSAGES[msgIdx]!);
      }, 2000);

      try {
        const fd = new FormData();
        fd.append("audio", blob, "voice.webm");
        fd.append("clientId", clientId);

        const tr = await apiFetchFormData<{ transcript: string }>("/voice/transcribe", fd, {
          timeoutMs: 90_000
        });
        setTranscript(tr.transcript ?? "");

        const gen = await apiFetch<VoiceGenerateResult>("/voice/generate", {
          method: "POST",
          body: JSON.stringify({ transcript: tr.transcript, clientId })
        });
        setBundle(gen);
        setStatus("preview");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Voice pipeline failed");
        setStatus("error");
      } finally {
        clearInterval(msgTimer);
      }
    },
    [clientId]
  );

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state !== "recording") return;
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    rec.onstop = () => {
      stopStream();
      mediaRecorderRef.current = null;
      setAudioLevel(0);
      const mime = rec.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mime });
      if (blob.size < 32) {
        setError("Recording too short — try again.");
        setStatus("error");
        return;
      }
      void sendToBackend(blob);
    };
    rec.stop();
  }, [sendToBackend, stopStream]);

  const savePost = useCallback(
    async (edits: {
      caption: string;
      hashtags: string[];
      scheduledTimeIso: string;
      platform: VoiceIntentShape["platform"];
    }) => {
      if (!clientId) return;
      setError(null);
      try {
        await apiFetch("/voice/save", {
          method: "POST",
          body: JSON.stringify({
            clientId,
            caption: edits.caption,
            hashtags: edits.hashtags,
            scheduledTime: edits.scheduledTimeIso,
            platform: edits.platform
          }),
          timeoutMs: 30_000
        });
        setStatus("idle");
        setBundle(null);
        setTranscript("");
        onScheduled?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save post");
        setStatus("error");
      }
    },
    [clientId, onScheduled]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setBundle(null);
    setTranscript("");
    setAudioLevel(0);
    setElapsedSec(0);
  }, []);

  return {
    status,
    transcript,
    bundle,
    error,
    audioLevel,
    processingMessage,
    elapsedSec,
    startRecording,
    stopRecording,
    savePost,
    reset
  };
}
