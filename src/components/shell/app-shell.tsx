import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Brain,
  Compass,
  LayoutGrid,
  MessageSquare,
  Settings,
  Waypoints,
} from "lucide-react";
import { Onboarding } from "@/components/onboarding/onboarding";
import { CaptureDialog } from "@/components/capture/capture-dialog";
import { PresenceOrb } from "@/components/presence/orb";
import { WakeWordListener } from "@/components/companion/wake-word-listener";
import { useCompanion } from "@/lib/companion/store";
import { useCompanionSync } from "@/lib/companion/use-companion-sync";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Command", icon: LayoutGrid },
  { to: "/companion", label: "Talk", icon: MessageSquare },
  { to: "/world", label: "World", icon: Waypoints },
  { to: "/work", label: "Work", icon: Compass },
  { to: "/memory", label: "Memory", icon: Brain },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const hydrated = useCompanion((s) => s._hasHydrated);
  const onboarded = useCompanion((s) => s.onboarded);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    void useCompanion.persist.rehydrate();
    setReady(true);
  }, []);

  // Loads the server (Neon/Postgres) copy of the world model once on start,
  // and debounce-saves local changes back to it from then on.
  useCompanionSync();

  // The standalone Electron orb must render immediately; waiting for browser
  // storage hydration would show the opaque app loading screen in its window.
  if (pathname === "/orb") return <>{children}</>;

  if (!ready || !hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <PresenceOrb state="thinking" />
      </div>
    );
  }

  if (!onboarded) return <Onboarding />;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <WakeWordListener />
      <div className="mx-auto flex min-h-dvh max-w-[1400px]">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border px-3 py-5 md:flex">
          <Link to="/" className="flex items-center gap-3 px-2">
            <PresenceOrb size="sm" />
            <div>
              <div className="font-display text-lg leading-none">Chief</div>
              <div className="mt-1 text-[0.65rem] tracking-[0.2em] text-subtle uppercase">
                Partner
              </div>
            </div>
          </Link>
          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm transition-colors duration-[var(--motion-quick)]",
                    active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface hover:text-fg",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="space-y-1">
            <div className="px-1">
              <CaptureDialog />
            </div>
            <Link
              to="/settings"
              className={cn(
                "flex h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm text-muted hover:bg-surface hover:text-fg",
                pathname === "/settings" && "bg-surface-2 text-fg",
              )}
            >
              <Settings className="size-4" />
              Settings
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:hidden">
            <Link to="/" className="flex items-center gap-2">
              <PresenceOrb size="sm" />
              <span className="font-display text-lg">Chief</span>
            </Link>
            <div className="flex items-center gap-1">
              <CaptureDialog compact />
              <Link
                to="/settings"
                className="inline-flex size-11 items-center justify-center rounded-[var(--radius-md)] text-muted"
                aria-label="Settings"
              >
                <Settings className="size-4" />
              </Link>
            </div>
          </header>
          <main className="flex-1 px-4 py-5 pb-24 md:px-8 md:py-8 md:pb-8">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[0.65rem] tracking-wide",
                  active ? "text-fg" : "text-subtle",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
