import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useCompanion } from "@/lib/companion/store";
import { Badge } from "@/components/ui/badge";
import { lifecycleTone } from "@/components/status";
import type { Project } from "@/lib/companion/types";

type Node = {
  id: string;
  label: string;
  kind: "you" | "goal" | "project" | "person" | "idea";
  x: number;
  y: number;
};

type Edge = { from: string; to: string };

const W = 980;
const H = 700;
const CX = 490;
const CY = 330;

function spread(n: number, i: number, center: number, span: number) {
  if (n <= 1) return center;
  const t = i / (n - 1);
  return center - span / 2 + t * span;
}

function shortLabel(s: string, n = 18) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function WorldPage() {
  const world = useCompanion();
  const [selected, setSelected] = useState<string>("you");

  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [
      { id: "you", label: world.profile.name || "You", kind: "you", x: CX, y: CY },
    ];
    const es: Edge[] = [];

    world.goals.forEach((g, i) => {
      ns.push({
        id: g.id,
        label: g.title,
        kind: "goal",
        x: spread(world.goals.length, i, CX, 460),
        y: 88,
      });
      es.push({ from: "you", to: g.id });
    });

    world.projects.forEach((p, i) => {
      ns.push({
        id: p.id,
        label: p.name,
        kind: "project",
        x: 860,
        y: spread(world.projects.length, i, CY + 10, 520),
      });
      const linked = world.goals.find((g) => g.relatedProjectIds.includes(p.id));
      es.push({ from: linked?.id ?? "you", to: p.id });
    });

    world.people.forEach((p, i) => {
      ns.push({
        id: p.id,
        label: p.name,
        kind: "person",
        x: 120,
        y: spread(world.people.length, i, CY, 160),
      });
      es.push({ from: "you", to: p.id });
    });

    const ideas = world.ideas.slice(0, 4);
    ideas.forEach((idea, i) => {
      ns.push({
        id: idea.id,
        label: idea.title,
        kind: "idea",
        x: spread(ideas.length, i, CX, 520),
        y: 620,
      });
      const rel = idea.relatedProjectIds[0];
      es.push({ from: rel && ns.some((n) => n.id === rel) ? rel : "you", to: idea.id });
    });

    return { nodes: ns, edges: es };
  }, [world.goals, world.projects, world.people, world.ideas, world.profile.name]);

  const active = nodes.find((n) => n.id === selected) ?? nodes[0];
  const project: Project | undefined = world.projects.find((p) => p.id === selected);
  const goal = world.goals.find((g) => g.id === selected);
  const person = world.people.find((p) => p.id === selected);
  const idea = world.ideas.find((i) => i.id === selected);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs tracking-[0.28em] text-muted uppercase">Knowledge graph</p>
        <h1 className="mt-2 font-display text-4xl leading-tight">Your world</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Relationships, not a junk drawer. Click a node. Chief reasons across these links.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="overflow-x-auto rounded-[var(--radius-xl)] bg-surface p-2 shadow-[var(--shadow-border)]">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full min-w-[640px] text-fg"
            role="img"
            aria-label="Personal knowledge graph"
          >
            <text x="490" y="36" textAnchor="middle" className="fill-subtle" fontSize="11">
              Goals
            </text>
            <text x="860" y="36" textAnchor="middle" className="fill-subtle" fontSize="11">
              Projects
            </text>
            <text x="120" y="36" textAnchor="middle" className="fill-subtle" fontSize="11">
              People
            </text>
            <text x="490" y="690" textAnchor="middle" className="fill-subtle" fontSize="11">
              Ideas
            </text>
            {edges.map((e) => {
              const a = nodes.find((n) => n.id === e.from);
              const b = nodes.find((n) => n.id === e.to);
              if (!a || !b) return null;
              const hot = selected === e.from || selected === e.to;
              return (
                <line
                  key={`${e.from}-${e.to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={hot ? "stroke-fg/28" : "stroke-fg/10"}
                  strokeWidth={hot ? 1.4 : 1}
                />
              );
            })}
            {nodes.map((n) => {
              const r = n.kind === "you" ? 30 : 12;
              const on = selected === n.id;
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  onClick={() => setSelected(n.id)}
                  className="cursor-pointer"
                >
                  <circle
                    r={r}
                    className={
                      n.kind === "you" ? "fill-primary" : on ? "fill-fg/20" : "fill-surface-2"
                    }
                    stroke="currentColor"
                    strokeOpacity={on || n.kind === "you" ? 0.9 : 0.2}
                    strokeWidth={on ? 1.6 : 1}
                  />
                  <text
                    y={r + 16}
                    textAnchor="middle"
                    className={n.kind === "you" ? "fill-fg" : "fill-muted"}
                    fontSize={n.kind === "you" ? 12 : 11}
                    fontFamily="Instrument Sans, sans-serif"
                  >
                    {shortLabel(n.label, n.kind === "you" ? 20 : 16)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <aside className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)]">
          <div className="text-[0.65rem] tracking-[0.18em] text-subtle uppercase">{active.kind}</div>
          <h2 className="mt-2 font-display text-2xl leading-tight">{active.label}</h2>
          {active.kind === "you" && (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {world.profile.role}. {world.profile.workingStyle}
            </p>
          )}
          {goal && (
            <div className="mt-3 space-y-2 text-sm text-muted">
              <p>{goal.why}</p>
              <Badge>P{goal.priority}</Badge>
            </div>
          )}
          {project && (
            <div className="mt-3 space-y-3 text-sm text-muted">
              <p>{project.objective}</p>
              <Badge tone={lifecycleTone(project.status)}>{project.status}</Badge>
              <p>{project.nextAction}</p>
              <Link to="/work/$id" params={{ id: project.id }} className="text-fg">
                Open project
              </Link>
            </div>
          )}
          {person && <p className="mt-3 text-sm text-muted">{person.notes || person.role}</p>}
          {idea && <p className="mt-3 text-sm text-muted">{idea.description}</p>}
        </aside>
      </div>
    </div>
  );
}
