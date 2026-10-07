import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { lifecycleTone } from "@/components/status";
import { useCompanion } from "@/lib/companion/store";
import { uid } from "@/lib/utils";

export function WorkPage() {
  const world = useCompanion();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");

  const goals = world.goals;
  const projects = world.projects;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.28em] text-muted uppercase">Work</p>
          <h1 className="mt-2 font-display text-4xl">Projects and goals</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Every initiative has a state, a next action, and a relationship to a goal.
          </p>
        </div>
        <Button variant="outline" onClick={() => setOpen((v) => !v)}>
          New project
        </Button>
      </header>

      {open && (
        <form
          className="space-y-3 rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            world.upsertProject({
              id: uid("proj"),
              name: name.trim(),
              objective: objective.trim() || name.trim(),
              status: "exploring",
              progress: 0,
              tasks: [],
              blockers: [],
              peopleIds: [],
              resources: [],
              lastTouched: new Date().toISOString(),
            });
            setName("");
            setObjective("");
            setOpen(false);
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
          <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Objective" rows={3} />
          <Button type="submit">Add to world</Button>
        </form>
      )}

      <section>
        <h2 className="font-display text-2xl">Goals</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {goals.map((g) => (
            <article key={g.id} className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)]">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium">{g.title}</h3>
                <Badge>P{g.priority}</Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">{g.why}</p>
              <div className="mt-4 flex justify-between text-xs text-subtle">
                <span>{g.status}</span>
                <span className="tabular-nums">{g.progress}%</span>
              </div>
              <Progress value={g.progress} className="mt-2" />
            </article>
          ))}
          {goals.length === 0 && <p className="text-sm text-muted">No goals yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl">Projects</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/work/$id"
              params={{ id: p.id }}
              className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)] transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)]"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{p.name}</h3>
                <Badge tone={lifecycleTone(p.status)}>{p.status}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted">{p.objective}</p>
              <p className="mt-3 text-xs text-subtle">Next: {p.nextAction || "Unset"}</p>
              <Progress value={p.progress} className="mt-4" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
