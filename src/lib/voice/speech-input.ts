import { transcribeAudio } from "@/lib/ai/transcribe";
import { isElectronRuntime } from "@/lib/electron-bridge";

export interface SpeechInputOptions {
  /** Called once per recognized utterance, finalized text only. */
  onTranscript: (text: string) => void;
  /** Called on a listening-session problem worth surfacing to the user. */
  onError?: (message: string) => void;
}

export interface SpeechInputHandle {
  start: () => void;
  stop: () => void;
}

/**
 * One shared "listen continuously, hand back finalized utterances"
 * interface with two interchangeable backends, chosen once per session:
 *
 * - Electron (window.chief present): the OS-bundled Chromium there has no
 *   Google-authenticated speech backend, so the native SpeechRecognition API
 *   fails outright with a "network" error, regardless of actual internet
 *   connectivity — a locked door, not a bug. Falls back to recording raw
 *   audio (getUserMedia + MediaRecorder) and transcribing it server-side via
 *   Groq's hosted Whisper (see src/lib/ai/transcribe.ts).
 * - Everywhere else: the browser's built-in SpeechRecognition — free,
 *   near-instant, no server round-trip, no reason to replace it there.
 *
 * Callers (wake-word-listener.tsx, companion-page.tsx's conversation mode)
 * don't need to know or care which backend answered — same onTranscript
 * callback either way. Returns null only when NEITHER backend is usable
 * (native API missing AND — in principle — Whisper is always assumed
 * available in Electron, since it only needs a mic, not a specific browser
 * API), so callers should treat null as "voice input isn't available here."
 */
export function createSpeechInput(opts: SpeechInputOptions): SpeechInputHandle | null {
  return isElectronRuntime() ? createWhisperSpeechInput(opts) : createBrowserSpeechInput(opts);
}

// ---------------------------------------------------------------------------
// Backend 1: native browser SpeechRecognition (unchanged behavior from
// before this file existed — continuous, final-results-only, auto-restart on
// an unexpected end).
// ---------------------------------------------------------------------------

type NativeRecognition = {
  start: () => void;
  stop: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};

function getNativeRecognitionCtor(): (new () => NativeRecognition) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => NativeRecognition;
    webkitSpeechRecognition?: new () => NativeRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function createBrowserSpeechInput(opts: SpeechInputOptions): SpeechInputHandle | null {
  const Ctor = getNativeRecognitionCtor();
  if (!Ctor) return null;
  const RecognitionCtor = Ctor; // narrowing above doesn't persist into attach() below

  let recognition: NativeRecognition | null = null;
  let intentionallyStopped = false;

  function attach(): NativeRecognition {
    const rec = new RecognitionCtor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript?.trim();
      if (transcript) opts.onTranscript(transcript);
    };
    rec.onend = () => {
      if (!intentionallyStopped) {
        try {
          rec.start();
        } catch {
          // Browsers can reject an immediate restart; leave it — the next
          // explicit start() call will retry.
        }
      }
    };
    rec.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        opts.onError?.(event.error || "speech error");
      }
    };
    recognition = rec;
    return rec;
  }

  return {
    start() {
      intentionallyStopped = false;
      try {
        (recognition ?? attach()).start();
      } catch {
        opts.onError?.("Microphone permission is required.");
      }
    },
    stop() {
      intentionallyStopped = true;
      recognition?.stop();
      recognition = null;
    },
  };
}

// ---------------------------------------------------------------------------
// Backend 2: record raw audio + transcribe server-side via Groq Whisper.
//
// There's no browser event for "the user just said a complete phrase" here
// like native SpeechRecognition gives us for free — we have to detect that
// ourselves via a simple volume-based voice-activity gate: watch the mic's
// volume, and once it's been quiet for SILENCE_MS after some actual speech,
// treat that as the end of the utterance, cut the recording there, and start
// listening for the next one immediately (don't wait on the network
// round-trip for the previous clip).
// ---------------------------------------------------------------------------

const SILENCE_MS = 1400;
const MIN_SPEECH_MS = 450;
const MAX_CHUNK_MS = 20000;
const VOLUME_THRESHOLD = 0.02; // RMS of time-domain samples, roughly 0..1

function pickSupportedMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function createWhisperSpeechInput(opts: SpeechInputOptions): SpeechInputHandle {
  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let vadTimer: ReturnType<typeof setInterval> | null = null;
  let speechStartedAt = 0;
  let silenceStartedAt = 0;
  let chunkStartedAt = 0;
  let running = false;

  function startChunk() {
    if (!stream) return;
    const mimeType = pickSupportedMimeType();
    const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunks = [];
    chunkStartedAt = Date.now();
    speechStartedAt = 0;
    silenceStartedAt = Date.now();
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      const hadSpeech = speechStartedAt > 0;
      chunks = [];
      // Start listening for the NEXT utterance right away rather than
      // waiting on this clip's transcription round-trip.
      if (running) startChunk();
      if (hadSpeech && blob.size > 0) void sendForTranscription(blob);
    };
    rec.start();
    recorder = rec;
  }

  async function sendForTranscription(blob: Blob) {
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const audioBase64 = btoa(binary);
      const res = await transcribeAudio({ data: { audioBase64, mimeType: blob.type } });
      if (res.ok && res.text) {
        opts.onTranscript(res.text);
      } else if (!res.ok && res.error !== "Heard nothing." && res.error !== "Clip too short.") {
        opts.onError?.(res.error);
      }
    } catch (e) {
      opts.onError?.(e instanceof Error ? e.message : "Transcription failed.");
    }
  }

  function checkVoiceActivity() {
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (const sample of data) {
      const normalized = (sample - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    const now = Date.now();

    if (rms > VOLUME_THRESHOLD) {
      if (speechStartedAt === 0) speechStartedAt = now;
      silenceStartedAt = now;
    }

    const hasEnoughSpeech = speechStartedAt > 0 && now - speechStartedAt > MIN_SPEECH_MS;
    const longEnoughSilence = now - silenceStartedAt > SILENCE_MS;
    const chunkRunningTooLong = speechStartedAt > 0 && now - chunkStartedAt > MAX_CHUNK_MS;

    if ((hasEnoughSpeech && longEnoughSilence) || chunkRunningTooLong) {
      if (recorder && recorder.state !== "inactive") recorder.stop(); // -> onstop cuts + transcribes + restarts
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      void (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          opts.onError?.("Microphone permission is required.");
          running = false;
          return;
        }
        if (!running) {
          // stop() was called while the permission prompt was pending.
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        vadTimer = setInterval(checkVoiceActivity, 100);
        startChunk();
      })();
    },
    stop() {
      running = false;
      if (vadTimer) clearInterval(vadTimer);
      vadTimer = null;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null; // explicit stop — don't send a final trailing clip
        recorder.stop();
      }
      recorder = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      void audioCtx?.close();
      audioCtx = null;
      analyser = null;
    },
  };
}
