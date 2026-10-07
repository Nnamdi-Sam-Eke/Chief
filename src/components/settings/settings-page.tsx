import { useEffect, useState, type ReactNode } from "react";
import { PERMISSION_ORDER } from "@/lib/companion/types";
import type { PermissionLevel, PermissionPolicy } from "@/lib/companion/types";
import { useCompanion } from "@/lib/companion/store";
import { usePushSubscription } from "@/lib/push/use-push-subscription";
import { getGoogleCalendarStatus, disconnectGoogleCalendar } from "@/lib/integrations/google-oauth";
import { isElectronRuntime } from "@/lib/electron-bridge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { applyThemePreference, persistThemePreference, readStoredThemePreference, type ThemePreference } from "@/lib/theme";

const POLICY_KEYS: Array<{ key: keyof PermissionPolicy; label: string; hint: string }> = [
  { key: "memoryExtract", label: "Memory", hint: "What Chief may write into durable memory." },
  { key: "projectUpdate", label: "Projects", hint: "Updating status, tasks, next actions." },
  { key: "drafts", label: "Drafts", hint: "Preparing messages, plans, and task lists." },
  {
    key: "emailSend",
    label: "Email",
    hint: "Whether a proposed email becomes a draft automatically or waits for your go-ahead first. Either way, sending is always a separate manual step from the Drafts tab.",
  },
];

export function SettingsPage() {
  const world = useCompanion();
  const push = usePushSubscription();
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const [startupReady, setStartupReady] = useState(false);
  const [backgroundPresence, setBackgroundPresence] = useState(world.ambientModeEnabled);
  const [presenceReady, setPresenceReady] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(() => readStoredThemePreference());

  useEffect(() => {
    persistThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    void getGoogleCalendarStatus().then((res) => setGoogleConnected(res.connected));

    const params = new URLSearchParams(window.location.search);
    const result = params.get("google");
    if (result === "connected") {
      toast("Google Calendar connected.");
      setGoogleConnected(true);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (result === "error") {
      toast(`Couldn't connect Google Calendar (${params.get("reason") || "unknown error"}).`);
      window.history.replaceState({}, "", window.location.pathname);
    }

    // In Electron, OAuth happens in the external default browser, so re-check
    // when focus returns after the approval flow.
    const onFocus = () => {
      void getGoogleCalendarStatus().then((res) => setGoogleConnected(res.connected));
      if (isElectronRuntime()) {
        void window.chief?.getLaunchOnStartup().then(setLaunchOnStartup);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (!isElectronRuntime()) {
      setPresenceReady(true);
      return;
    }
    void window.chief!.getBackgroundPresence().then((enabled) => {
      setBackgroundPresence(enabled);
      setPresenceReady(true);
    }).catch(() => setPresenceReady(true));
  }, []);

  useEffect(() => {
    if (!isElectronRuntime()) return;
    void window.chief!.getLaunchOnStartup().then((enabled) => {
      setLaunchOnStartup(enabled);
      setStartupReady(true);
    }).catch(() => setStartupReady(true));
  }, []);

  function connectGoogle() {
    const url = `${window.location.origin}/oauth/google/start`;
    if (isElectronRuntime()) {
      window.chief?.openExternal(url);
    } else {
      window.location.href = url;
    }
  }

  async function disconnectGoogle() {
    setGoogleBusy(true);
    try {
      await disconnectGoogleCalendar();
      setGoogleConnected(false);
      toast("Google Calendar disconnected.");
    } finally {
      setGoogleBusy(false);
    }
  }

  function exportWorld() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            profile: world.profile,
            goals: world.goals,
            projects: world.projects,
            people: world.people,
            decisions: world.decisions,
            commitments: world.commitments,
            ideas: world.ideas,
            memories: world.memories,
            policy: world.policy,
            createdAt: world.createdAt,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chief-world.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <header>
        <p className="text-xs tracking-[0.28em] text-muted uppercase">Control</p>
        <h1 className="mt-2 font-display text-4xl">Settings</h1>
        <p className="mt-2 text-sm text-muted">
          Capability is not authority. You inspect the model and set the boundaries.
        </p>
      </header>

      <section className="space-y-4 rounded-[var(--radius-xl)] bg-surface p-4 shadow-[var(--shadow-border)]">
        <div>
          <h2 className="font-display text-2xl">Appearance</h2>
          <p className="mt-1 text-sm text-muted">Pick the surface Chief should live on.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["dark", "light"] as const).map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={theme === mode ? "default" : "outline"}
              onClick={() => {
                setTheme(mode);
                applyThemePreference(mode);
              }}
            >
              {mode === "dark" ? "Dark" : "Light"}
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">You</h2>
        <Field label="Name">
          <Input
            value={world.profile.name}
            onChange={(e) => world.setProfile({ name: e.target.value })}
          />
        </Field>
        <Field label="Role">
          <Input
            value={world.profile.role}
            onChange={(e) => world.setProfile({ role: e.target.value })}
          />
        </Field>
        <Field label="Current focus">
          <Input
            value={world.profile.currentFocus ?? ""}
            onChange={(e) => world.setProfile({ currentFocus: e.target.value })}
            placeholder="What you’re actually doing right now"
          />
        </Field>
        <Field label="Working style">
          <Textarea
            value={world.profile.workingStyle}
            onChange={(e) => world.setProfile({ workingStyle: e.target.value })}
            rows={3}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">Permissions</h2>
        <p className="text-sm text-muted">
          Observe → Suggest → Prepare → Ask → Execute → Autonomous.
        </p>
        {POLICY_KEYS.map((p) => (
          <div key={p.key} className="rounded-[var(--radius-xl)] bg-surface p-4 shadow-[var(--shadow-border)]">
            <div className="text-sm font-medium">{p.label}</div>
            <p className="mt-1 text-xs text-subtle">{p.hint}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PERMISSION_ORDER.map((level) => (
                <Button
                  key={level}
                  size="sm"
                  variant={world.policy[p.key] === level ? "default" : "outline"}
                  onClick={() => world.setPolicy({ [p.key]: level as PermissionLevel })}
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="flex items-center justify-between gap-4 rounded-[var(--radius-xl)] bg-surface p-4 shadow-[var(--shadow-border)]">
        <div>
          <div className="text-sm font-medium">Voice replies</div>
          <p className="mt-1 text-xs text-subtle">Chief speaks summaries after answering.</p>
        </div>
        <Switch
          checked={world.voiceEnabled}
          onCheckedChange={(v) => world.setVoiceEnabled(v)}
          aria-label="Voice replies"
        />
      </section>

      <section className="space-y-4 rounded-[var(--radius-xl)] bg-surface p-4 shadow-[var(--shadow-border)]">
        <div>
          <h2 className="font-display text-2xl">Ambient OS</h2>
          <p className="mt-1 text-sm text-muted">
            Ambient, not invasive. Start quietly, stay useful, and keep power in the user’s hands.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Background presence</div>
            <p className="mt-1 text-xs text-subtle">{isElectronRuntime() ? "Keep the orb available when the main window is hidden. The tray menu stays in sync." : "Desktop shell only; a browser cannot keep a floating orb above other apps."}</p>
          </div>
          <Switch
            checked={backgroundPresence}
            disabled={!isElectronRuntime() || !presenceReady}
            onCheckedChange={(v) => {
              void window.chief?.setBackgroundPresence(v).then((saved) => {
                if (saved) setBackgroundPresence(v);
                else toast("Could not save background presence on this device.");
              }).catch(() => toast("Could not update background presence."));
            }}
            aria-label="Background presence"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Launch on startup</div>
            <p className="mt-1 text-xs text-subtle">
              {isElectronRuntime()
                ? "Starts Chief in the background when your device boots."
                : "Desktop shell only — this setting is available in the Electron app."}
            </p>
          </div>
          <Switch
            checked={launchOnStartup}
            disabled={!isElectronRuntime() || !startupReady}
            onCheckedChange={(v) => {
              void window.chief?.setLaunchOnStartup(v).then((enabled) => {
                setLaunchOnStartup(enabled);
                toast(enabled === v ? "Startup setting updated." : "Could not update startup setting.");
              }).catch(() => toast("Could not update startup setting."));
            }}
            aria-label="Launch on startup"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Screen context</div>
            <p className="mt-1 text-xs text-subtle">Enable the one-shot Capture screen action in Talk. Nothing is captured until you press it.</p>
          </div>
          <Switch
            checked={world.screenContextEnabled}
            onCheckedChange={(v) => world.setAmbientSettings({ screenContextEnabled: v })}
            aria-label="Screen context"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Local file access</div>
            <p className="mt-1 text-xs text-subtle">Enable one-time selection of text files from a folder. Selected contents are only sent with your next message.</p>
          </div>
          <Switch
            checked={world.localFileAccessEnabled}
            onCheckedChange={(v) => world.setAmbientSettings({ localFileAccessEnabled: v })}
            aria-label="Local file access"
          />
        </div>
      </section>

      <section className="flex items-center justify-between gap-4 rounded-[var(--radius-xl)] bg-surface p-4 shadow-[var(--shadow-border)]">
        <div>
          <div className="text-sm font-medium">Hey Chief listening</div>
          <p className="mt-1 text-xs text-subtle">
            Keeps the browser microphone listening for “Hey Chief”. Only works while this app is open.
          </p>
        </div>
        <Switch
          checked={world.alwaysListening}
          onCheckedChange={(v) => world.setAlwaysListening(v)}
          aria-label="Hey Chief listening"
        />
      </section>

      <section className="flex items-center justify-between gap-4 rounded-[var(--radius-xl)] bg-surface p-4 shadow-[var(--shadow-border)]">
        <div>
          <div className="text-sm font-medium">Notifications</div>
          <p className="mt-1 text-xs text-subtle">
            {push.status === "unsupported" &&
              "Not available in this browser (or the app isn't configured for it yet)."}
            {push.status === "denied" &&
              "Blocked at the browser level — re-enable notifications for this site in your browser settings."}
            {push.status === "unsubscribed" &&
              "Get notified when Chief's background check finds something, even with the app closed."}
            {push.status === "subscribed" && "This browser will get notified when Chief notices something."}
          </p>
        </div>
        {push.status === "subscribed" ? (
          <Button variant="outline" size="sm" disabled={push.busy} onClick={() => void push.disable()}>
            Turn off
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={push.busy || push.status === "unsupported" || push.status === "denied"}
            onClick={() => void push.enable()}
          >
            Turn on
          </Button>
        )}
      </section>

      <section className="flex items-center justify-between gap-4 rounded-[var(--radius-xl)] bg-surface p-4 shadow-[var(--shadow-border)]">
        <div>
          <div className="text-sm font-medium">Google Calendar</div>
          <p className="mt-1 text-xs text-subtle">
            {googleConnected === null && "Checking connection…"}
            {googleConnected === false &&
              "Read-only — lets Chief see what's on your calendar. It can't create or change events."}
            {googleConnected === true && "Connected. Chief can see your upcoming events."}
          </p>
        </div>
        {googleConnected ? (
          <Button variant="outline" size="sm" disabled={googleBusy} onClick={() => void disconnectGoogle()}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" disabled={googleConnected === null} onClick={connectGoogle}>
            Connect
          </Button>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">World data</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportWorld}>
            Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              world.refreshInsights();
              toast("Insights rebuilt from the world model");
            }}
          >
            Rebuild insights
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Clear conversation but keep the world model?")) {
                useCompanion.setState({ messages: [] });
              }
            }}
          >
            Clear chat
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Reset everything, including memory?")) world.resetWorld();
            }}
          >
            Reset workspace
          </Button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs tracking-wide text-subtle uppercase">{label}</span>
      {children}
    </label>
  );
}
