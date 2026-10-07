import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { askChief } from "@/lib/ai/ask";
import { useCompanion } from "@/lib/companion/store";
import { createSpeechInput } from "@/lib/voice/speech-input";
import type { SpeechInputHandle } from "@/lib/voice/speech-input";

function extractRequest(transcript: string): string | null {
  const normalized = transcript
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/\b(chief|cheif|chef)\b/g, "chief")
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/\bhey\s+chief\b\s*(.*)$/i);
  return match ? match[1].trim() : null;
}

export function WakeWordListener() {
  const enabled = useCompanion((s) => s.alwaysListening);
  const handleRef = useRef<SpeechInputHandle | null>(null);
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followUpRef = useRef(false);
  const busyRef = useRef(false);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      handleRef.current?.stop();
      handleRef.current = null;
      followUpRef.current = false;
      if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
      if (useCompanion.getState().presence === "listening") {
        useCompanion.getState().setPresence("idle");
      }
      return;
    }

    const handle = createSpeechInput({
      onTranscript: (transcript) => {
        if (busyRef.current) return;
        const request = followUpRef.current ? transcript : extractRequest(transcript);
        if (request === null) return;
        followUpRef.current = false;
        if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
        busyRef.current = true;
        // Wake-word requests should be audible even when Talk-page voice
        // replies are disabled; otherwise the global listener appears
        // unresponsive.
        void askChief(request || transcript, { speak: true }).finally(() => {
          busyRef.current = false;
        });
      },
      onError: (message) => toast(`Hey Chief listening stopped: ${message}.`),
    });

    if (!handle) {
      if (!warnedRef.current) {
        toast("Hey Chief listening needs Chrome or another browser with speech recognition.");
        warnedRef.current = true;
      }
      return;
    }

    handleRef.current = handle;
    handle.start();
    useCompanion.getState().setPresence("listening");

    return () => {
      handle.stop();
      handleRef.current = null;
      if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
    };
  }, [enabled]);

  return null;
}