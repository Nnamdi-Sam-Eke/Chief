import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { lifecycleTone } from "@/components/status";
import { useCompanion } from "@/lib/companion/store";
import { uid } from "@/lib/utils";
import { useEffect, useState } from "react";
import type { Lifecycle, TaskStatus } from "@/lib/companion/types";
import { LIFECYCLE_ORDER } from "@/lib/companion/types";

export function ProjectDetail({ id }: { id: string }) {
  const world = useCompanion();
  const project = world.projects.find((p) => p.id === id);
  const [taskTitle, setTaskTitle] = useState("");

  useEffect(() => {
    if (project) world.touchProject(project.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!project) {
    return (
      <div>
        <p className="text-muted">That project isn’t in the world model.</p>
        <Link to="/work" className="mt-3 inline-block text-sm text-fg">
          Back to work
        </Link>
      </div>
    );
  }

  const decisions = world.decisions.filter((d) => d.projectId === project.id);
  const commitments = world.commitments.filter((c) => c.relatedProjectId === project.id);
  const relatedGoals = world.goals.filter((g) => g.relatedProjectIds.includes(project.id));

  return (
    <div className="space-y-8">
      <Link to="/work" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Work
      </Link>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={lifecycleTone(project.status)}>{project.status}</Badge>
            {project.blockers[0] && <Badge tone="warn">blocked</Badge>}
          </div>
          <h1 className="mt-3 font-display text-4xl leading-tight">{project.name}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{project.objective}</p>
        </div>
        <div className="w-full max-w-xs rounded-[var(--radius-xl)] bg-surface p-4 shadow-[var(--shadow-border)]">
          <div className="flex justify-between text-xs text-subtle">
            <span>Progress</span>
            <span className="tabular-nums">{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="mt-2" />
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)] lg:col-span-2">
          <h2 className="text-sm font-medium">Next action</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg">
            {project.nextAction || "No next action set."}
          </p>
          {project.notes && <p className="mt-3 text-sm text-muted">{project.notes}</p>}
          {project.blockers.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-warn">
              {project.blockers.map((b) => (
                <li key={b}>Blocker: {b}</li>
              ))}
            </ul>
          )}
        </article>
        <article className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">Lifecycle</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {LIFECYCLE_ORDER.filter((s) => s !== "idea").map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => world.upsertProject({ ...project, status: s as Lifecycle })}
                className="rounded-full"
              >
                <Badge tone={project.status === s ? lifecycleTone(s) : "default"}>{s}</Badge>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-2xl">Tasks</h2>
        <ul className="mt-4 space-y-2">
          {project.tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
              <span className={t.status === "done" ? "text-subtle line-through" : "text-fg"}>
                {t.title}
              </span>
              <select
                className="h-9 rounded-[var(--radius-sm)] bg-surface-2 px-2 text-xs text-muted shadow-[var(--shadow-border)]"
                value={t.status}
                onChange={(e) => {
                  const status = e.target.value as TaskStatus;
                  world.upsertProject({
                    ...project,
                    tasks: project.tasks.map((x) => (x.id === t.id ? { ...x, status } : x)),
                  });
                }}
              >
                <option value="todo">todo</option>
                <option value="doing">doing</option>
                <option value="done">done</option>
                <option value="blocked">blocked</option>
              </select>
            </li>
          ))}
        </ul>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!taskTitle.trim()) return;
            world.upsertProject({
              ...project,
              tasks: [...project.tasks, { id: uid("t"), title: taskTitle.trim(), status: "todo" }],
            });
            setTaskTitle("");
          }}
        >
          <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Add a task" />
          <Button type="submit" variant="outline">
            Add
          </Button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Block title="Related goals">
          {relatedGoals.length === 0 && <p className="text-sm text-muted">None linked.</p>}
          {relatedGoals.map((g) => (
            <p key={g.id} className="text-sm">
              {g.title}
            </p>
          ))}
        </Block>
        <Block title="Decisions">
          {decisions.length === 0 && <p className="text-sm text-muted">None recorded.</p>}
          {decisions.map((d) => (
            <div key={d.id} className="text-sm">
              <div className="text-fg">{d.statement}</div>
              <div className="mt-1 text-xs text-muted">{d.why}</div>
            </div>
          ))}
        </Block>
        <Block title="Commitments">
          {commitments.length === 0 && <p className="text-sm text-muted">None open.</p>}
          {commitments.map((c) => (
            <p key={c.id} className="text-sm">
              {c.title} <span className="text-subtle">({c.status})</span>
            </p>
          ))}
        </Block>
      </section>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)]">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </article>
  );
}
