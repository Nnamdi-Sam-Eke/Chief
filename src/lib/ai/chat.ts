import { createServerFn } from "@tanstack/react-start";
import { CHIEF_SYSTEM } from "@/lib/companion/world-brief";
import { getUpcomingEvents } from "@/lib/integrations/google-calendar.server";
import type { CompanionReply } from "@/lib/companion/types";

type ChatInput = {
  worldBrief: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  message: string;
  contextText?: string;
  imageDataUrl?: string;
};

function extractJson(text: string): CompanionReply & { parseFailed?: boolean } {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return { reply: trimmed, parseFailed: true };
  }
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as CompanionReply;
    if (parsed && typeof parsed.reply === "string") return parsed;
  } catch {
    /* fall through */
  }
  // Something didn't parse as the expected shape — surface that instead of
  // silently dropping whatever mutations were meant to be in here. The raw
  // text still becomes the reply so the conversation isn't lost either.
  return { reply: trimmed, parseFailed: true };
}

function formatCalendar(events: Array<{ summary: string; start: string; end: string }>): string {
  if (events.length === 0) return "Nothing on the calendar in the near term.";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return events
    .map((e) => {
      const when = e.start && !Number.isNaN(Date.parse(e.start)) ? fmt.format(new Date(e.start)) : e.start;
      return `- ${when}: ${e.summary}`;
    })
    .join("\n");
}

export const talkToChief = createServerFn({ method: "POST" })
  .validator((input: ChatInput) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "Chief is not connected in this environment." };
    }

    const history = data.history.slice(-8).map((m) => ({
      role: m.role,
      content: m.content.slice(0, 1500),
    }));

    // Live, not part of the client-computed worldBrief — stays silent
    // (no message at all) if Google Calendar isn't connected, rather than
    // telling the model "nothing's on the calendar" when really it just
    // can't see one at all.
    const events = await getUpcomingEvents().catch(() => null);
    const calendarMessages = events
      ? [{ role: "system", content: `CALENDAR (next ${events.length} events)\n${formatCalendar(events)}` }]
      : [];

    const contextText = typeof data.contextText === "string"
      ? data.contextText.slice(0, 16000)
      : "";
    const imageDataUrl = typeof data.imageDataUrl === "string"
      ? data.imageDataUrl
      : "";
    if (imageDataUrl && (
      imageDataUrl.length > 900000 ||
      !/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(imageDataUrl)
    )) {
      return { ok: false as const, error: "The screen capture is invalid or too large. Please capture it again." };
    }
    const userText = [
      data.message.slice(0, 3000),
      contextText ? `USER-SELECTED FILE CONTEXT (read-only)\n${contextText}` : "",
    ].filter(Boolean).join("\n\n");

    const userContent = imageDataUrl
      ? [
          { type: "text", text: userText || "Please describe this screen." },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ]
      : userText;
    const messages = [
      { role: "system", content: CHIEF_SYSTEM },
      ...calendarMessages,
      {
        role: "system",
        content: `WORLD MODEL\n${data.worldBrief.slice(0, 14000)}`,
      },
      ...history,
      { role: "user", content: userContent },
    ];

    const model = imageDataUrl
      ? process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct"
      : process.env.GROQ_MODEL || "openai/gpt-oss-20b";

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_tokens: 1400,
        // Without this, the model can (and did, observed with gpt-oss-20b)
        // just reply in plain prose and skip the JSON contract entirely —
        // the system prompt asking for JSON is a request, not a guarantee.
        // json_object mode makes the API itself enforce valid JSON syntax
        // (not schema-exact, but syntactically real — extractJson()'s
        // shape check below is still the safety net for that last mile).
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false as const,
        error: `Chief couldn't reach the reasoning layer (${res.status}).`,
        detail: errText.slice(0, 240),
      };
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    if (!text) {
      return { ok: false as const, error: "Chief returned an empty thought." };
    }

    return { ok: true as const, data: extractJson(text) };
  });