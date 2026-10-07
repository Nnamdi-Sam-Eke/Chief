import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ArrowRight, Check, X } from "lucide-react";
import { PresenceOrb } from "@/components/presence/orb";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LOOP, lifecycleTone, severityTone } from "@/components/status";
import { detectAmbientContext } from "@/lib/companion/ambient-context";
import { summarizeAmbientState } from "@/lib/companion/ambient-summary";
import { suggestedPrompts } from "@/lib/companion/insights";
import { useCompanion } from "@/lib/companion/store";
import { cn } from "@/lib/utils";

function hourGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function safeDate(iso?: string) {
  if (!iso) return null;
  try {
    return parseISO(iso);
  } catch {
    return null;
  }
}

export function CommandPage() {
  const world = useCompanion();
  const name = world.profile.name.split(" ")[0] || "there";
  const insights = Array.isArray(world.insights) ? world.insights.filter((i) => !i.dismissed) : [];
  const pending = Array.isArray(world.commitments) ? world.commitments.filter((c) => c.status === "pending") : [];
  const activeProjects = Array.isArray(world.projects)
    ? world.projects.filter((p) => !["abandoned", "paused", "idea"].includes(p.status))
    : [];
  const prompts = suggestedPrompts(world);
  const goals = Array.isArray(world.goals) ? world.goals : [];
  const topGoal = [...goals]
    .filter((g) => g.status === "active")
    .sort((a, b) => a.priority - b.priority)[0];
  const ambientSummary = summarizeAmbientState({
    currentFocus: world.profile.currentFocus,
    presence: world.presence,
    projects: activeProjects,
    insights,
  });
  const liveContext = detectAmbientContext({
    currentFocus: world.profile.currentFocus,
    presence: world.presence,
    blockerCount: activeProjects.reduce((total, project) => total + (project.blockers?.length ?? 0), 0),
    insightCount: insights.length,
    activeProjectCount: activeProjects.length,
  });

  const take =
    insights[0]?.body ??
    (Array.isArray(world.projects) && world.projects.length
      ? "The world model is live. Start with the highest-leverage next action, not the most pleasant one."
      : "The board is empty. Tell me what you’re building.");

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs tracking-[0.28em] text-muted uppercase">{hourGreeting()}</p>
          <h1 className="mt-2 font-display text-4xl leading-[1.05] text-fg sm:text-5xl">
            {name}.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            {world.profile.currentFocus
              ? `Current focus: ${world.profile.currentFocus}`
              : "Here’s where things actually stand."}
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-[var(--radius-xl)] bg-surface p-4 shadow-[var(--shadow-border)]">
          <PresenceOrb />
          <div className="max-w-sm">
            <div className="text-[0.65rem] tracking-[0.2em] text-subtle uppercase">Chief</div>
            <p className="mt-1 text-sm leading-snug text-fg">{take}</p>
          </div>
        </div>
      </header>

      <LoopRail />

      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.9fr]">
        <div className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[0.65rem] tracking-[0.2em] text-subtle uppercase">Ambient state</div>
              <h2 className="mt-2 font-display text-2xl text-fg">What Chief sees</h2>
            </div>
            <Badge tone={insights.some((i) => i.severity === "urgent") ? "danger" : "ok"}>
              {ambientSummary.statusLabel}
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">{ambientSummary.statusText}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {ambientSummary.signals.map((signal) => (
              <div key={signal.label} className="rounded-[var(--radius-md)] bg-surface-2 p-3">
                <div className="text-[0.65rem] tracking-[0.18em] text-subtle uppercase">{signal.label}</div>
                <div className="mt-2 text-sm text-fg">{signal.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)]">
          <div className="text-[0.65rem] tracking-[0.2em] text-subtle uppercase">Detected mode</div>
          <h3 className="mt-2 font-display text-xl text-fg">{liveContext.mode}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted">{liveContext.guidance}</p>
          <div className="mt-4 rounded-[var(--radius-md)] bg-surface-2 p-3 text-sm text-fg">
            {liveContext.recommendedAction}
          </div>
          <button
            type="button"
            className="mt-5 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-primary px-4 py-2 text-sm font-medium text-primary-fg"
            onClick={() => {
              const focus = ambientSummary.focusText === "Set a primary focus" && activeProjects[0]
                ? activeProjects[0].name
                : ambientSummary.focusText;
              world.setFocus(focus);
            }}
          >
            Keep this focus
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Today" hint="Commitments and next actions">
          {pending.length === 0 ? (
            <Empty>No open commitments.</Empty>
          ) : (
            <ul className="space-y-3">
              {pending.slice(0, 5).map((c) => {
                const due = safeDate(c.due);
                return (
                  <li key={c.id} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-fg">{c.title}</div>
                      <div className="mt-0.5 text-xs text-subtle">
                        {due
                          ? formatDistanceToNow(due, { addSuffix: true })
                          : "No due date"}
                      </div>
                    </div>
                    <Badge tone="warn">open</Badge>
                  </li>
                );
              })}
            </ul>
          )}
          <Link to="/memory" className="mt-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
            Memory vault <ArrowRight className="size-3.5" />
          </Link>
        </Panel>

        <Panel title="Attention" hint="Conflicts, drift, deadlines">
          {insights.length === 0 ? (
            <Empty>Quiet. No contradictions detected.</Empty>
          ) : (
            <ul className="space-y-3">
              {insights.slice(0, 4).map((i) => (
                <li key={i.id} className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge tone={severityTone(i.severity)}>{i.severity}</Badge>
                      <span className="truncate text-sm text-fg">{i.title}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{i.body}</p>
                  </div>
                  {i.pendingKind ? (
                    <button
                      type="button"
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-subtle hover:text-fg"
                      aria-label="Approve"
                      title="Go ahead"
                      onClick={() => world.approveInsight(i.id)}
                    >
                      <Check className="size-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-subtle hover:text-fg"
                    aria-label="Dismiss"
                    onClick={() => world.dismissInsight(i.id)}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Priority" hint={topGoal ? topGoal.title : "No active goal"}>
          {topGoal ? (
            <div>
              <p className="text-sm leading-relaxed text-muted">{topGoal.why}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-subtle">
                <span>P{topGoal.priority}</span>
                <span className="tabular-nums">{topGoal.progress}%</span>
              </div>
              <Progress value={topGoal.progress} className="mt-2" />
              {topGoal.deadline && (
                <p className="mt-3 text-xs text-subtle">
                  Horizon {format(parseISO(topGoal.deadline), "d MMM")}
                </p>
              )}
            </div>
          ) : (
            <Empty>Set a goal and I’ll rank the board against it.</Empty>
          )}
        </Panel>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-fg">Active work</h2>
            <p className="mt-1 text-sm text-muted">Ranked by whether it actually serves the current goal.</p>
          </div>
          <Link to="/work" className="text-sm text-muted hover:text-fg">
            All work
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {activeProjects.slice(0, 6).map((p) => (
            <Link
              key={p.id}
              to="/work/$id"
              params={{ id: p.id }}
              className="rounded-[var(--radius-xl)] bg-surface p-4 shadow-[var(--shadow-border)] transition-[box-shadow] duration-[var(--motion-quick)] hover:shadow-[var(--shadow-border-hover)]"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-fg">{p.name}</h3>
                <Badge tone={lifecycleTone(p.status)}>{p.status}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{p.nextAction}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-subtle">
                <span className="tabular-nums">{p.progress}%</span>
                {p.blockers[0] && <span className="truncate text-warn">Blocked</span>}
              </div>
              <Progress value={p.progress} className="mt-2" />
            </Link>
          ))}
          {activeProjects.length === 0 && <Empty>No active projects yet.</Empty>}
        </div>
      </section>

      <section className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl">Talk to Chief</h2>
            <p className="mt-1 text-sm text-muted">Ask for a briefing, a challenge, or a draft.</p>
          </div>
          <Link
            to="/companion"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 text-sm font-medium text-primary-fg"
          >
            Open companion
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {prompts.map((q) => (
            <Link
              key={q}
              to="/companion"
              search={{ q }}
              className="rounded-full bg-surface-2 px-3 py-2 text-xs text-muted shadow-[var(--shadow-border)] hover:text-fg"
            >
              {q}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function LoopRail() {
  return (
    <div className="loop-rail rounded-[var(--radius-xl)] bg-surface px-2 py-3 shadow-[var(--shadow-border)]">
      {LOOP.map((stage, i) => (
        <div key={stage} className="flex min-w-0 items-center">
          <div
            className={cn(
              "px-3 py-1 text-[0.65rem] tracking-[0.16em] uppercase",
              i === 0 ? "text-fg" : "text-subtle",
            )}
          >
            {stage}
          </div>
          {i < LOOP.length - 1 && <span className="text-subtle">→</span>}
        </div>
      ))}
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)]">
      <h2 className="text-sm font-medium text-fg">{title}</h2>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}