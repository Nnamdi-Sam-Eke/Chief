import { createServerFn } from "@tanstack/react-start";

export const speakChief = createServerFn({ method: "POST" })
  .validator((input: { text: string }) => input)
  .handler(async ({ data }) => {
    // Reuses the same key chat.ts already authenticates with — no separate
    // TTS provider/signup needed. Groq's playai-tts is available on the same
    // free/pay-as-you-go tier as the chat models, with no per-voice gating.
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "Chief is not connected in this environment." };
    }

    const text = data.text.replace(/\s+/g, " ").trim().slice(0, 420);
    if (!text) return { ok: false as const, error: "Nothing to speak." };

    // Full voice list (English): Arista, Atlas, Basil, Briggs, Calum, Celeste,
    // Cheyenne, Chip, Cillian, Deedee, Fritz, Gail, Indigo, Mamaw, Mason,
    // Mikail, Mitch, Quinn, Thunder — each suffixed "-PlayAI".
    const voice = process.env.GROQ_TTS_VOICE || "Fritz-PlayAI";
    const model = process.env.GROQ_TTS_MODEL || "playai-tts";

    const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        response_format: "wav",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false as const, error: `Voice error ${res.status}`, detail: errText.slice(0, 240) };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    return {
      ok: true as const,
      mime: res.headers.get("content-type") || "audio/wav",
      audio: buf.toString("base64"),
    };
  });