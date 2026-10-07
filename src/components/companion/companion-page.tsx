import { useEffect, useRef, useState } from "react";
import { FolderOpen, Mic, MonitorUp, Send, Square, Trash2, Volume2 } from "lucide-react";
import { PresenceOrb } from "@/components/presence/orb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askChief } from "@/lib/ai/ask";
import { suggestedPrompts } from "@/lib/companion/insights";
import { useCompanion } from "@/lib/companion/store";
import { createSpeechInput } from "@/lib/voice/speech-input";
import type { SpeechInputHandle } from "@/lib/voice/speech-input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function CompanionPage({ preset }: { preset?: string }) {
  const world = useCompanion();
  const [text, setText] = useState(preset ?? "");
  const [error, setError] = useState<string | null>(null);
  const [screenCapture, setScreenCapture] = useState<string | null>(null);
  const [screenBusy, setScreenBusy] = useState(false);
  const [fileContext, setFileContext] = useState<{ label: string; text: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const speechHandleRef = useRef<SpeechInputHandle | null>(null);
  const prompts = suggestedPrompts(world);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [world.messages.length, world.presence]);

  useEffect(() => {
    if (preset) setText(preset);
  }, [preset]);

  useEffect(() => {
    if (!world.screenContextEnabled) setScreenCapture(null);
  }, [world.screenContextEnabled]);

  useEffect(() => {
    if (!world.localFileAccessEnabled) setFileContext(null);
  }, [world.localFileAccessEnabled]);

  async function captureScreen() {
    if (!world.screenContextEnabled || screenBusy) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast("Screen capture is not available in this environment.");
      return;
    }
    setScreenBusy(true);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement("video");
      video.muted = true;
      const metadataReady = new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Could not read the selected screen."));
      });
      video.srcObject = stream;
      await metadataReady;
      await video.play();
      let width = video.videoWidth;
      let height = video.videoHeight;
      const scale = Math.min(1, 1280 / width, 900 / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Screen capture could not be prepared.");
      let dataUrl = "";
      for (let attempt = 0; attempt < 4; attempt += 1) {
        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);
        dataUrl = canvas.toDataURL("image/jpeg", 0.62);
        if (dataUrl.length <= 850000) break;
        width = Math.round(width * 0.75);
        height = Math.round(height * 0.75);
      }
      if (!dataUrl || dataUrl.length > 850000) {
        throw new Error("That screen is too large to attach. Try sharing a smaller window.");
      }
      setScreenCapture(dataUrl);
      toast("Screen captured. It will only be sent with your next message.");
    } catch (captureError) {
      const message = captureError instanceof Error ? captureError.message : "Screen capture was cancelled.";
      if (!message.toLowerCase().includes("permission denied") && !message.toLowerCase().includes("cancel")) {
        toast(message);
      }
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      setScreenBusy(false);
    }
  }

  async function attachFolder(files: File[]) {
    if (!world.localFileAccessEnabled) return;
    const supported = /\.(txt|md|csv|json|ya?ml|toml|js|jsx|ts|tsx|css|html|xml|log|py|go|rs|java|c|cpp|h|sql|sh|ps1)$/i;
    const selected = files.filter((file) => supported.test(file.name)).slice(0, 20);
    const entries: string[] = [];
    let remaining = 16000;
    for (const file of selected) {
      if (file.size > 512000 || remaining <= 0) continue;
      const content = (await file.text()).slice(0, remaining);
      if (!content) continue;
      entries.push(`--- ${file.webkitRelativePath || file.name} ---\n${content}`);
      remaining -= content.length;
    }
    if (entries.length === 0) {
      toast("No supported text files found in that folder.");
      return;
    }
    setFileContext({ label: `${entries.length} text file${entries.length === 1 ? "" : "s"}`, text: entries.join("\n\n") });
    toast("Selected folder content is ready for your next message only.");
  }

  async function send(raw?: string) {
    const hasContext = Boolean(screenCapture || fileContext);
    const message = (raw ?? text).trim() || (hasContext
      ? "Please review the context I attached and tell me what matters."
      : "");
    const store = useCompanion.getState();
    if (!message || store.presence === "thinking") return;
    const displayMessage = [
      message,
      screenCapture ? "[Screen capture attached]" : "",
      fileContext ? `[${fileContext.label} attached]` : "",
    ].filter(Boolean).join("\n");
    const contextText = fileContext?.text;
    const imageDataUrl = screenCapture ?? undefined;
    const streamingAssistantId = `stream-${Date.now()}`;
    setText("");
    setError(null);
    setScreenCapture(null);
    setFileContext(null);
    useCompanion.setState((state) => ({
      messages: [
        ...state.messages,
        { id: streamingAssistantId, role: "assistant", content: "", created: new Date().toISOString() },
      ],
    }));

    // askChief itself owns the presence lifecycle now (thinking -> speaking,
    // if voice is on -> back to idle/listening) so the orb reflects Chief's
    // ACTUAL state in real time, including the full duration it's genuinely
    // speaking — not a local copy that only ever got flipped to "speaking"
    // after playback had already finished. Reading store.voiceEnabled fresh
    // (not the closured `world` prop) matters here since this function gets
    // captured once inside the conversation-mode recognition callback below,
    // not re-created per render.
    const res = await askChief(message, {
      speak: store.voiceEnabled,
      contextText,
      imageDataUrl,
      displayMessage,
      persist: false,
      onPartial: (partial) => {
        useCompanion.setState((state) => ({
          messages: state.messages.map((m) =>
            m.id === streamingAssistantId ? { ...m, content: partial } : m,
          ),
        }));
      },
    });
    if (!res.ok) {
      useCompanion.setState((state) => ({
        messages: state.messages.filter((m) => m.id !== streamingAssistantId),
      }));
      setError(res.error);
      store.ingestReply(
        message,
        "I couldn't reach the reasoning layer. Your world model is still here — try again in a moment.",
      );
      return;
    }

    useCompanion.setState((state) => ({
      messages: state.messages.filter((m) => m.id !== streamingAssistantId),
    }));
    useCompanion.getState().ingestReply(displayMessage, res.reply, res.mutations, res.parseFailed);
  }

  const sendRef = useRef(send);
  sendRef.current = send;

  // "Conversation mode": click once, then just talk — no wake word, no
  // re-clicking per message, the same way typing-and-hitting-enter doesn't
  // need re-arming. The tricky part is that this mic must NOT keep listening
  // while Chief is actually speaking its reply out loud, or it can hear
  // itself through your speakers and reply to its own voice in a feedback
  // loop — so this effect pauses listening for the "thinking"/"speaking"
  // window and resumes the moment presence returns to idle/listening. This
  // applies identically to both speech-input backends (browser or Whisper),
  // which is exactly why that concern lives here rather than inside either
  // backend.
  const [conversationMode, setConversationMode] = useState(false);

  useEffect(() => {
    if (!conversationMode) {
      speechHandleRef.current?.stop();
      speechHandleRef.current = null;
      return;
    }
    const shouldListen = world.presence === "idle" || world.presence === "listening";
    if (!shouldListen) {
      speechHandleRef.current?.stop();
      speechHandleRef.current = null;
      return;
    }
    if (speechHandleRef.current) return; // already listening, nothing to do

    const handle = createSpeechInput({
      onTranscript: (transcript) => {
        if (transcript) void sendRef.current(transcript);
      },
      onError: (message) => toast(`Conversation mode stopped: ${message}`),
    });
    if (!handle) {
      toast("Voice input isn’t available in this browser. Type instead.");
      setConversationMode(false);
      return;
    }
    speechHandleRef.current = handle;
    handle.start();
    useCompanion.getState().setPresence("listening");
  }, [conversationMode, world.presence]);

  // Stop the mic if you navigate away mid-conversation.
  useEffect(() => {
    return () => {
      speechHandleRef.current?.stop();
    };
  }, []);

  function toggleConversationMode() {
    setConversationMode((v) => {
      const next = !v;
      if (next) {
        toast("Conversation mode on — just talk. I’ll pause while I’m replying so I don’t hear myself.");
      }
      return next;
    });
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] max-w-3xl flex-col md:h-[calc(100dvh-4rem)]">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PresenceOrb state={world.presence} size="sm" />
          <div>
            <h1 className="font-display text-2xl leading-none">Chief</h1>
            <p className="mt-1 text-xs text-subtle">
              {world.presence === "thinking"
                ? "Reasoning over your world model"
                : world.presence === "listening"
                  ? "Listening"
                  : world.presence === "speaking"
                    ? "Speaking"
                    : world.profile.currentFocus || "Holding context"}
            </p>
          </div>
        </div>
        <Button
          variant={world.voiceEnabled ? "default" : "outline"}
          size="sm"
          onClick={() => world.setVoiceEnabled(!world.voiceEnabled)}
        >
          <Volume2 />
          Voice {world.voiceEnabled ? "on" : "off"}
        </Button>
      </header>

      <div
        ref={scroller}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
      >
        {world.messages.length === 0 && (
          <div className="rounded-[var(--radius-xl)] bg-surface p-6 shadow-[var(--shadow-border)]">
            <p className="font-display text-2xl leading-snug text-fg">
              I’m holding your world. Don’t brief me from scratch.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Ask where things stand, capture a thought, or tell me to challenge the week.
              I’ll remember decisions, commitments, and ideas — and I’ll say when the
              work doesn’t match the goal.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {prompts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void send(q)}
                  className="rounded-full bg-surface-2 px-3 py-2 text-left text-xs text-muted shadow-[var(--shadow-border)] hover:text-fg"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {world.messages.map((m) => (
          <article
            key={m.id}
            className={cn(
              "max-w-[42rem]",
              m.role === "user" ? "ml-auto" : "mr-auto",
            )}
          >
            <div
              className={cn(
                "rounded-[var(--radius-lg)] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-surface-2 text-fg shadow-[var(--shadow-border)]"
                  : "bg-surface text-fg shadow-[var(--shadow-border)]",
              )}
            >
              {m.content}
            </div>
            {m.mutations && m.mutations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.mutations.map((mu, i) => (
                  <Badge key={`${m.id}-${i}`}>{mu.kind}: {mu.label}</Badge>
                ))}
              </div>
            )}
            {m.draft && (
              <div className="mt-2 rounded-[var(--radius-lg)] bg-surface-2 p-3 shadow-[var(--shadow-border)]">
                <div className="text-[0.65rem] tracking-[0.16em] text-subtle uppercase">
                  Prepared {m.draft.kind}
                </div>
                <div className="mt-1 text-sm font-medium">{m.draft.title}</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {m.draft.body}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    void navigator.clipboard.writeText(m.draft!.body);
                    toast("Copied draft");
                  }}
                >
                  Copy
                </Button>
              </div>
            )}
          </article>
        ))}

        {world.presence === "thinking" && (
          <div className="flex items-center gap-3 text-sm text-muted">
            <PresenceOrb state="thinking" size="sm" />
            <span className="shimmer bg-clip-text">Reading the board…</span>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!world.screenContextEnabled || screenBusy}
            onClick={() => void captureScreen()}
          >
            <MonitorUp />
            {screenBusy ? "Capturing…" : "Capture screen"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!world.localFileAccessEnabled}
            onClick={() => folderInput.current?.click()}
          >
            <FolderOpen />
            Choose folder
          </Button>
          <input
            ref={folderInput}
            className="sr-only"
            type="file"
            multiple
            {...({ webkitdirectory: "" } as Record<string, string>)}
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              void attachFolder(files);
            }}
          />
        </div>
        {(screenCapture || fileContext) && (
          <div className="space-y-2 rounded-[var(--radius-md)] bg-surface px-3 py-2 shadow-[var(--shadow-border)]">
            <div className="flex items-center gap-3">
              {screenCapture && <img src={screenCapture} alt="Screen capture attached" className="h-12 w-20 rounded object-cover" />}
              <p className="min-w-0 flex-1 text-xs text-muted">
                {[screenCapture && "Screen capture", fileContext?.label].filter(Boolean).join(" · ")} ready to send once.
              </p>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Remove attached context"
                onClick={() => {
                  setScreenCapture(null);
                  setFileContext(null);
                }}
              >
                <Trash2 />
              </Button>
            </div>
            {fileContext && (
              <details className="text-xs text-muted">
                <summary className="cursor-pointer">Review selected file contents before sending</summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface-2 p-2">{fileContext.text}</pre>
              </details>
            )}
          </div>
        )}
        <p className="text-xs text-subtle">
          Selected content is sent to Chief’s configured AI provider only when you send a message; it is not saved to your world memory.
        </p>
      </div>

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Button
          type="button"
          variant={conversationMode ? "default" : "outline"}
          size="icon"
          aria-label={conversationMode ? "Stop conversation mode" : "Start conversation mode (speak instead of typing)"}
          onClick={toggleConversationMode}
        >
          {conversationMode ? <Square /> : <Mic />}
        </Button>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Talk to Chief"
          rows={2}
          className="min-h-12 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button type="submit" size="icon" disabled={(!text.trim() && !screenCapture && !fileContext) || world.presence === "thinking"} aria-label="Send">
          <Send />
        </Button>
      </form>
    </div>
  );
}