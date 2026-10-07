import { toast } from "sonner";

/**
 * Speaks text via the browser's built-in speech synthesis. No API key, no
 * network call, no rate limits — everything runs client-side. Returns a
 * Promise that resolves when speech actually finishes, so callers can await
 * it to know when Chief is done talking.
 */
export function playVoice(text: string): Promise<void> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      toast("Voice failed: this browser doesn't support speech synthesis.");
      resolve();
      return;
    }
    // Cancel anything already queued/speaking so replies don't stack up if
    // Chief gets asked something new before finishing the last answer.
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;

    // Prefer a higher-quality installed voice over the OS default if one is
    // available. Voice lists load async on first page visit in some
    // browsers, so fall back gracefully if none are populated yet.
    const voices = synth.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith("en") && /Google|Natural|Premium|Enhanced/i.test(v.name),
    );
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
      toast(`Voice failed: ${e.error || "speech synthesis error"}.`);
      resolve();
    };
    synth.speak(utterance);
  });
}
