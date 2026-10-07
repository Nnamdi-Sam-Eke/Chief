import { createServerFn } from "@tanstack/react-start";

/**
 * Speech-to-text for the Electron shell (see src/lib/voice/speech-input.ts
 * for why: Electron's bundled Chromium has no Google-authenticated speech
 * backend, so the native SpeechRecognition API fails there outright).
 * Reuses the same GROQ_API_KEY chat.ts and tts.ts already authenticate
 * with — no separate provider/signup needed.
 */
export const transcribeAudio = createServerFn({ method: "POST" })
  .validator((input: { audioBase64: string; mimeType: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "Chief is not connected in this environment." };
    }

    const buffer = Buffer.from(data.audioBase64, "base64");
    // A real utterance is at least a few KB even for a short phrase — this
    // guards against burning a Groq call transcribing near-silent noise the
    // client-side volume gate let through right at its edge.
    if (buffer.byteLength < 800) {
      return { ok: false as const, error: "Clip too short." };
    }

    const ext = data.mimeType.includes("webm") ? "webm" : data.mimeType.includes("mp4") ? "mp4" : "wav";
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: data.mimeType || "audio/webm" }), `speech.${ext}`);
    form.append("model", process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo");
    form.append("response_format", "json");
    form.append("language", "en");

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false as const,
        error: `Transcription error ${res.status}`,
        detail: errText.slice(0, 240),
      };
    }

    const body = (await res.json()) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) return { ok: false as const, error: "Heard nothing." };
    return { ok: true as const, text };
  });
