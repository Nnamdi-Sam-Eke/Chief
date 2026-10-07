import { uid } from "@/lib/utils";
import type {
  AppliedMutation,
  CompanionWorld,
  Draft,
  Insight,
  MutationPayload,
  PermissionLevel,
} from "./types";
import { PERMISSION_ORDER } from "./types";

/** True once `level` reaches at least `min` on the observe→autonomous ladder. */
function meets(level: PermissionLevel, min: PermissionLevel): boolean {
  return PERMISSION_ORDER.indexOf(level) >= PERMISSION_ORDER.indexOf(min);
}

/**
 * Everything below "execute" (observe / suggest / prepare / ask) is not
 * auto-applied. Instead it's parked as an Insight carrying the untouched
 * payload item, so approving it later is a single call to
 * applyPendingInsight() with the exact same shape Chief originally proposed —
 * nothing is re-derived or re-typed by hand.
 */
function queuePending<K extends keyof MutationPayload>(
  insights: Insight[],
  kind: K,
  label: string,
  item: unknown,
  stamp: string,
): void {
  insights.unshift({
    id: uid("ins"),
    title: `Chief wants to: ${label}`,
    body: "Awaiting your go-ahead — current permission for this category is below execute.",
    severity: "attention",
    created: stamp,
    pendingKind: kind,
    pendingPayload: item,
  });
}

export function applyMutations(
  world: CompanionWorld,
  payload?: MutationPayload | null,
): { world: CompanionWorld; applied: AppliedMutation[]; draft?: Draft } {
  if (!payload) return { world, applied: [] };

  const applied: AppliedMutation[] = [];
  const next: CompanionWorld = {
    ...world,
    goals: [...world.goals],
    projects: world.projects.map((p) => ({ ...p, tasks: [...p.tasks] })),
    people: [...world.people],
    decisions: [...world.decisions],
    commitments: [...world.commitments],
    ideas: [...world.ideas],
    memories: [...world.memories],
    insights: [...world.insights],
    drafts: [...world.drafts],
    profile: { ...world.profile },
  };
  const stamp = new Date().toISOString();
  const policy = world.policy;

  for (const m of payload.memories ?? []) {
    if (!m.content?.trim()) continue;
    if (!meets(policy.memoryExtract, "execute")) {
      queuePending(next.insights, "memories", m.content.trim().slice(0, 72), m, stamp);
      continue;
    }
    next.memories.push({
      id: uid("mem"),
      kind: m.kind ?? "episodic",
      content: m.content.trim(),
      source: "conversation",
      confidence: m.confidence ?? "inference",
      created: stamp,
      tags: m.tags ?? [],
    });
    applied.push({ kind: "memory", label: m.content.trim().slice(0, 72) });
  }

  for (const d of payload.decisions ?? []) {
    if (!d.statement?.trim()) continue;
    if (!meets(policy.decisions, "execute")) {
      queuePending(next.insights, "decisions", d.statement.trim().slice(0, 72), d, stamp);
      continue;
    }
    next.decisions.unshift({
      id: uid("dec"),
      statement: d.statement.trim(),
      why: (d.why ?? "").trim() || "Recorded from conversation.",
      date: stamp,
      alternatives: d.alternatives ?? [],
      status: d.status ?? "active",
      projectId: d.projectId,
    });
    applied.push({ kind: "decision", label: d.statement.trim().slice(0, 72) });
  }

  for (const c of payload.commitments ?? []) {
    if (!c.title?.trim()) continue;
    if (!meets(policy.commitments, "execute")) {
      queuePending(next.insights, "commitments", c.title.trim().slice(0, 72), c, stamp);
      continue;
    }
    const existing = next.commitments.find(
      (x) =>
        x.status === "pending" &&
        x.title.toLowerCase() === c.title.trim().toLowerCase(),
    );
    if (c.status && existing) {
      existing.status = c.status;
      applied.push({ kind: "commitment", label: `${c.status}: ${existing.title}` });
      continue;
    }
    next.commitments.unshift({
      id: uid("com"),
      title: c.title.trim(),
      owner: next.profile.name,
      created: stamp,
      due: c.due,
      status: c.status ?? "pending",
      relatedProjectId: c.relatedProjectId,
      relatedPersonId: c.relatedPersonId,
    });
    applied.push({ kind: "commitment", label: c.title.trim().slice(0, 72) });
  }

  for (const idea of payload.ideas ?? []) {
    if (!idea.title?.trim()) continue;
    if (!meets(policy.ideas, "execute")) {
      queuePending(next.insights, "ideas", idea.title.trim().slice(0, 72), idea, stamp);
      continue;
    }
    next.ideas.unshift({
      id: uid("idea"),
      title: idea.title.trim(),
      description: idea.description?.trim() || idea.title.trim(),
      context: idea.context,
      relatedProjectIds: idea.relatedProjectIds ?? [],
      potentialValue: idea.potentialValue,
      status: idea.status ?? "unvalidated",
      created: stamp,
    });
    applied.push({ kind: "idea", label: idea.title.trim().slice(0, 72) });
  }

  for (const u of payload.projectUpdates ?? []) {
    if (!meets(policy.projectUpdate, "execute")) {
      queuePending(next.insights, "projectUpdates", u.name ?? u.id ?? "project update", u, stamp);
      continue;
    }
    const project = u.id
      ? next.projects.find((p) => p.id === u.id)
      : u.name
        ? next.projects.find(
            (p) => p.name.toLowerCase() === u.name!.trim().toLowerCase(),
          )
        : undefined;
    if (project) {
      if (u.status) project.status = u.status;
      if (typeof u.progress === "number") project.progress = u.progress;
      if (u.nextAction) project.nextAction = u.nextAction;
      if (u.blockers) project.blockers = u.blockers;
      if (u.notes) project.notes = u.notes;
      if (u.objective) project.objective = u.objective;
      project.lastTouched = stamp;
      if (u.addTask?.title) {
        project.tasks.push({
          id: uid("t"),
          title: u.addTask.title,
          status: u.addTask.status ?? "todo",
        });
      }
      applied.push({ kind: "project", label: `Updated ${project.name}` });
    } else if (u.name) {
      next.projects.unshift({
        id: uid("proj"),
        name: u.name.trim(),
        objective: u.objective || u.name.trim(),
        status: u.status ?? "exploring",
        progress: u.progress ?? 0,
        tasks: u.addTask?.title
          ? [{ id: uid("t"), title: u.addTask.title, status: u.addTask.status ?? "todo" }]
          : [],
        blockers: u.blockers ?? [],
        peopleIds: [],
        resources: [],
        nextAction: u.nextAction,
        notes: u.notes,
        lastTouched: stamp,
      });
      applied.push({ kind: "project", label: `Opened ${u.name.trim()}` });
    }
  }

  for (const g of payload.goalUpdates ?? []) {
    if (!meets(policy.goalUpdate, "execute")) {
      queuePending(next.insights, "goalUpdates", g.title ?? g.id ?? "goal update", g, stamp);
      continue;
    }
    const goal = g.id
      ? next.goals.find((x) => x.id === g.id)
      : g.title
        ? next.goals.find((x) => x.title.toLowerCase() === g.title!.trim().toLowerCase())
        : undefined;
    if (goal) {
      if (typeof g.progress === "number") goal.progress = g.progress;
      if (g.status) goal.status = g.status;
      if (g.why) goal.why = g.why;
      if (g.priority) goal.priority = g.priority;
      applied.push({ kind: "goal", label: `Updated ${goal.title}` });
    } else if (g.title) {
      next.goals.unshift({
        id: uid("goal"),
        title: g.title.trim(),
        why: g.why,
        priority: g.priority ?? 2,
        progress: g.progress ?? 0,
        status: g.status ?? "active",
        relatedProjectIds: [],
      });
      applied.push({ kind: "goal", label: `Added ${g.title.trim()}` });
    }
  }

  for (const i of payload.insights ?? []) {
    if (!i.title?.trim()) continue;
    next.insights.unshift({
      id: uid("ins"),
      title: i.title.trim(),
      body: i.body?.trim() || i.title.trim(),
      severity: i.severity ?? "info",
      created: stamp,
    });
    applied.push({ kind: "insight", label: i.title.trim() });
  }

  if (payload.profileUpdates) {
    const pu = payload.profileUpdates;
    if (!meets(policy.profileUpdate, "execute")) {
      queuePending(next.insights, "profileUpdates", "update working model of you", pu, stamp);
    } else {
      if (pu.currentFocus) next.profile.currentFocus = pu.currentFocus;
      if (pu.workingStyle) next.profile.workingStyle = pu.workingStyle;
      if (pu.addPrinciple) next.profile.principles = [...next.profile.principles, pu.addPrinciple];
      if (pu.addStrength) next.profile.strengths = [...next.profile.strengths, pu.addStrength];
      applied.push({ kind: "profile", label: "Updated working model of you" });
    }
  }

  let draft: Draft | undefined;
  if (payload.draft?.body) {
    draft = {
      id: uid("draft"),
      title: payload.draft.title || "Prepared draft",
      body: payload.draft.body,
      kind: payload.draft.kind ?? "message",
      created: stamp,
    };
    next.drafts.unshift(draft);
    applied.push({ kind: "draft", label: draft.title });
  }

  for (const email of payload.emailDrafts ?? []) {
    if (!email.to?.trim() || !email.body?.trim()) continue;
    if (!meets(policy.emailSend, "execute")) {
      queuePending(
        next.insights,
        "emailDrafts",
        `email ${email.to.trim()}: ${email.subject || "(no subject)"}`,
        email,
        stamp,
      );
      continue;
    }
    const emailDraft: Draft = {
      id: uid("draft"),
      title: email.subject?.trim() || `Email to ${email.to.trim()}`,
      body: email.body.trim(),
      kind: "email",
      created: stamp,
      to: email.to.trim(),
      subject: email.subject?.trim(),
    };
    next.drafts.unshift(emailDraft);
    applied.push({ kind: "draft", label: emailDraft.title });
  }

  if (next.memories.length > 80) next.memories = next.memories.slice(-80);
  if (next.insights.length > 24) next.insights = next.insights.slice(0, 24);
  if (next.drafts.length > 12) next.drafts = next.drafts.slice(0, 12);

  return { world: next, applied, draft };
}

const ARRAY_PAYLOAD_KEYS = new Set<keyof MutationPayload>([
  "memories",
  "decisions",
  "commitments",
  "ideas",
  "projectUpdates",
  "goalUpdates",
  "insights",
  "emailDrafts",
]);

/**
 * Approve a single gated insight: re-runs applyMutations with just that one
 * item, temporarily at "autonomous" so it can't be re-blocked by the same
 * policy that queued it, then drops the now-resolved insight. This is the
 * "yes, do it" path for anything Chief proposed under ask/prepare/suggest.
 */
export function applyPendingInsight(
  world: CompanionWorld,
  insight: Insight,
): { world: CompanionWorld; applied: AppliedMutation[]; draft?: Draft } {
  if (!insight.pendingKind || insight.pendingPayload === undefined) {
    return { world, applied: [] };
  }
  const elevatedPolicy: CompanionWorld["policy"] = {
    memoryExtract: "autonomous",
    decisions: "autonomous",
    commitments: "autonomous",
    ideas: "autonomous",
    projectUpdate: "autonomous",
    goalUpdate: "autonomous",
    profileUpdate: "autonomous",
    drafts: "autonomous",
    emailSend: "autonomous",
  };
  const elevated: CompanionWorld = { ...world, policy: elevatedPolicy };

  const payload = {
    [insight.pendingKind]: ARRAY_PAYLOAD_KEYS.has(insight.pendingKind)
      ? [insight.pendingPayload]
      : insight.pendingPayload,
  } as MutationPayload;

  const result = applyMutations(elevated, payload);
  const insights = Array.isArray(result.world.insights)
    ? result.world.insights.filter((i) => i.id !== insight.id)
    : [];
  return { ...result, world: { ...result.world, insights, policy: world.policy } };
}