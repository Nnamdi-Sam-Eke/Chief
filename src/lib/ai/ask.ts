import { talkToChief } from "@/lib/ai/chat";
import { playVoice } from "@/lib/ai/voice";
import { useCompanion } from "@/lib/companion/store";
import { buildWorldBrief } from "@/lib/companion/world-brief";
import type { MutationPayload } from "@/lib/companion/types";
import { streamTextContent } from "@/lib/streaming";

const AFFIRMATIONS = new Set([
  "yes",
  "yep",
  "yeah",
  "yup",
  "do it",
  "go ahead",
  "approved",
  "confirm",
  "confirmed",
  "make it so",
  "go for it",
  "sure, do it",
  "yes, do it",
]);

export function isAffirmation(raw: string): boolean {
  const t = raw.trim().toLowerCase().replace(/[.!]+$/, "");
  return AFFIRMATIONS.has(t);
}

export type AskResult =
  | {
      ok: true;
      reply: string;
      spoken: string;
      mutations?: MutationPayload | null;
      parseFailed?: boolean;
    }
  | { ok: false; error: string };

/**
 * The full "say something to Chief" pipeline, independent of any UI: resolve
 * pending approvals if the message is a bare affirmation, build the current
 * world brief, call the reasoning layer, write the result into the world
 * model, and — if requested — speak the reply. Both the chat page and the
 * wake-word listener call this so the behavior can't drift between them.
 */
export async function askChief(
  message: string,
  opts: {
    speak?: boolean;
    contextText?: string;
    imageDataUrl?: string;
    displayMessage?: string;
    persist?: boolean;
    onPartial?: (partial: string) => void;
  } = {},
): Promise<AskResult> {
  const trimmed = message.trim();
  if (!trimmed) return { ok: false, error: "Nothing to ask." };
  const displayMessage = opts.displayMessage ?? trimmed;

  const world = useCompanion.getState();
  if (opts.imageDataUrl && !world.screenContextEnabled) {
    return { ok: false, error: "Screen context is disabled in Ambient OS settings." };
  }
  if (opts.contextText && !world.localFileAccessEnabled) {
    return { ok: false, error: "Local file access is disabled in Ambient OS settings." };
  }
  const idleState = () => (useCompanion.getState().alwaysListening ? "listening" : "idle");

  const pending = Array.isArray(world.insights)
    ? world.insights.filter((i) => i.pendingKind && i.pendingPayload !== undefined && !i.dismissed)
    : [];
  if (pending.length && isAffirmation(trimmed)) {
    for (const insight of pending) {
      useCompanion.getState().approveInsight(insight.id);
    }
  }

  useCompanion.getState().setPresence("thinking");
  const fresh = useCompanion.getState();
  const history = fresh.messages.map((m) => ({ role: m.role, content: m.content }));
  const brief = buildWorldBrief(fresh);

  try {
    const res = await talkToChief({
      data: {
        worldBrief: brief,
        history,
        message: trimmed,
        contextText: opts.contextText,
        imageDataUrl: opts.imageDataUrl,
      },
    });
    if (!res.ok) {
      useCompanion
        .getState()
        .ingestReply(
          displayMessage,
          "I couldn't reach the reasoning layer. Your world model is still here — try again in a moment.",
        );
      useCompanion.getState().setPresence(idleState());
      return { ok: false, error: res.error };
    }
    const finalReply = res.data.reply;
    if (opts.onPartial) {
      await streamTextContent(finalReply, opts.onPartial, {
        chunkSize: 2,
        intervalMs: 18,
      });
    }
    if (opts.persist !== false) {
      useCompanion
        .getState()
        .ingestReply(displayMessage, finalReply, res.data.mutations, res.data.parseFailed);
    }

    const spoken = res.data.spoken || finalReply;
    if (opts.speak) {
      useCompanion.getState().setPresence("speaking");
      await playVoice(spoken);
    }
    useCompanion.getState().setPresence(idleState());
    return {
      ok: true,
      reply: finalReply,
      spoken,
      mutations: res.data.mutations,
      parseFailed: res.data.parseFailed,
    };
  } catch (e) {
    useCompanion.getState().setPresence(idleState());
    const error = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error };
  }
}
