import { differenceInCalendarDays, parseISO } from "date-fns";
import { uid } from "@/lib/utils";
import type { CompanionWorld, Draft, Insight, PermissionLevel } from "./types";
import { PERMISSION_ORDER } from "./types";

function dayDiff(iso?: string) {
  if (!iso) return null;
  try {
    return differenceInCalendarDays(parseISO(iso), new Date());
  } catch {
    return null;
  }
}

function meets(level: PermissionLevel, min: PermissionLevel): boolean {
  return PERMISSION_ORDER.indexOf(level) >= PERMISSION_ORDER.indexOf(min);
}

/**
 * "Notices → proposes → prepares" without waiting to be asked, matched to
 * the actual permission the user has granted for drafts. Below "prepare",
 * this does nothing extra — the insight alone is the whole behavior.
 * At "prepare" or above, it finds-or-creates a Draft so the insight isn't
 * just a flag, it's an artifact ready to send/act on. Reuses an existing
 * draft with the same title instead of spawning a duplicate every refresh.
 */
function findOrMakeDraft(
  existingDrafts: Draft[],
  newDrafts: Draft[],
  title: string,
  body: string,
  kind: Draft["kind"],
  stamp: string,
): string {
  const found =
    existingDrafts.find((d) => d.title === title) ??
    newDrafts.find((d) => d.title === title);
  if (found) return found.id;
  const draft: Draft = { id: uid("draft"), title, body, kind, created: stamp };
  newDrafts.push(draft);
  return draft.id;
}

export function deriveInsights(
  world: CompanionWorld,
): { insights: Insight[]; drafts: Draft[] } {
  const out: Insight[] = [];
  const newDrafts: Draft[] = [];
  const created = new Date().toISOString();
  const canPrepare = meets(world.policy.drafts, "prepare");

  const pending = world.commitments.filter((c) => c.status === "pending");
  for (const c of pending) {
    const d = dayDiff(c.due);
    if (d !== null && d <= 0) {
      const insight: Insight = {
        id: uid("ins"),
        title: d < 0 ? "Overdue commitment" : "Due today",
        body: `${c.title}.`,
        severity: d < 0 ? "urgent" : "attention",
        created,
        href: "/memory",
      };
      if (canPrepare) {
        const draftId = findOrMakeDraft(
          world.drafts,
          newDrafts,
          `Follow-up: ${c.title}`,
          `Quick note on "${c.title}" — this was ${d < 0 ? "due" : "due today"}${c.due ? ` (${c.due})` : ""}. [Draft the actual follow-up text once you know who this goes to.]`,
          "message",
          created,
        );
        insight.draftId = draftId;
        insight.body = `${c.title}. Follow-up drafted — Memory → Drafts.`;
      } else {
        insight.body = `${c.title}. Want a draft, or should we just mark the next step?`;
      }
      out.push(insight);
    }
  }

  // The "north star" is whatever active goal Nnamdi has actually marked
  // priority 1 — not a goal we guess at by title keyword. Ties broken by
  // whichever was created/appears first in the array.
  const northStar = world.goals
    .filter((g) => g.status === "active")
    .sort((a, b) => a.priority - b.priority)[0];
  const northStarProjects = northStar
    ? world.projects.filter((p) => northStar.relatedProjectIds.includes(p.id))
    : [];

  // Drift: current focus text doesn't mention any project tied to the
  // top-priority goal. Works for whatever the goal/projects are named.
  if (northStar && northStarProjects.length && world.profile.currentFocus) {
    const focus = world.profile.currentFocus.toLowerCase();
    const onTrack = northStarProjects.some((p) =>
      focus.includes(p.name.toLowerCase()),
    );
    if (!onTrack) {
      out.push({
        id: uid("ins"),
        title: "Attention is drifting",
        body: `“${northStar.title}” is the top priority, but current focus is “${world.profile.currentFocus}” — that doesn't touch it. ${northStarProjects[0].name} has more leverage right now.`,
        severity: "attention",
        created,
        href: "/work",
      });
    }
  }

  // Cold project: linked to the top priority (or, absent one, any
  // committed/building project) and hasn't been touched in a while.
  const STALE_DAYS = 4;
  const watchlist = northStarProjects.length
    ? northStarProjects
    : world.projects.filter((p) => p.status === "committed" || p.status === "building");
  for (const p of watchlist) {
    const stale = dayDiff(p.lastTouched);
    if (stale !== null && stale <= -STALE_DAYS) {
      const insight: Insight = {
        id: uid("ins"),
        title: `${p.name} is cold`,
        body: `Nothing has moved on ${p.name} in ${Math.abs(stale)} days. ${p.deadline ? "Deadline is close." : "No deadline set."}`,
        severity: "urgent",
        created,
        href: `/work/${p.id}`,
      };
      if (canPrepare) {
        const steps = p.nextAction
          ? `Next action on record: ${p.nextAction}.`
          : "No next action on record — pick one before touching it again.";
        const draftId = findOrMakeDraft(
          world.drafts,
          newDrafts,
          `Restart plan: ${p.name}`,
          `${p.name} has gone ${Math.abs(stale)} days without movement.\n\n${steps}${p.blockers.length ? `\nOpen blockers: ${p.blockers.join("; ")}.` : ""}\n\nSmallest next step to break the stall: [fill in].`,
          "plan",
          created,
        );
        insight.draftId = draftId;
        insight.body += " Restart plan drafted — Memory → Drafts.";
      }
      out.push(insight);
    }
  }

  // Launched-but-stalled: shipped, then gone quiet — a decision is owed
  // (kill it, park it, or double down), whatever the project is.
  const LAUNCHED_STALE_DAYS = 10;
  for (const p of world.projects) {
    if (p.status !== "launched") continue;
    const stale = dayDiff(p.lastTouched);
    if (stale !== null && stale <= -LAUNCHED_STALE_DAYS) {
      out.push({
        id: uid("ins"),
        title: `${p.name} is waiting on a decision`,
        body: `Launched, quiet for ${Math.abs(stale)} days. Either commit to pushing it or park it — leaving it live with no owner is its own decision.`,
        severity: "info",
        created,
        href: `/work/${p.id}`,
      });
    }
  }

  const blocked = world.projects.filter((p) => p.blockers.length > 0 && p.status === "building");
  for (const p of blocked) {
    out.push({
      id: uid("ins"),
      title: `${p.name} is blocked`,
      body: p.blockers[0] ?? "A blocker is sitting on the critical path.",
      severity: "attention",
      created,
      href: `/work/${p.id}`,
    });
  }

  const active = world.projects.filter(
    (p) => p.status === "building" || p.status === "committed" || p.status === "launched",
  );
  if (northStar && active.length >= 5) {
    const contributing = active.filter((p) =>
      northStar.relatedProjectIds.includes(p.id),
    ).length;
    out.push({
      id: uid("ins"),
      title: "Too many live initiatives",
      body: `${active.length} active initiatives, and only ${contributing} directly serve “${northStar.title}”. The rest are optional until that one moves.`,
      severity: "attention",
      created,
      href: "/world",
    });
  }

  const resurfaced = world.ideas.filter((i) => i.status === "exploring" || i.status === "committed");
  if (resurfaced.length) {
    const idea = resurfaced[0];
    out.push({
      id: uid("ins"),
      title: "An idea is becoming a direction",
      body: `“${idea.title}” is no longer a stray thought. Treat it as a real product question.`,
      severity: "info",
      created,
      href: "/memory",
    });
  }

  const rank = { urgent: 0, attention: 1, info: 2 } as const;
  const insights = out.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 6);
  return { insights, drafts: newDrafts };
}

export function suggestedPrompts(world: CompanionWorld): string[] {
  const name = world.profile.name || "there";
  const prompts = [
    `Chief, what the hell am I doing?`,
    `Where should ${name} spend the next two hours?`,
  ];
  const blocked = world.projects.find((p) => p.blockers.length);
  if (blocked) prompts.push(`Where are we with ${blocked.name}?`);
  const due = world.commitments.find((c) => c.status === "pending");
  if (due) prompts.push(`Draft the follow-up: ${due.title.toLowerCase()}.`);
  const decision = world.decisions.find((d) => d.status === "revisit");
  if (decision) prompts.push(`Should we still stand by: ${decision.statement}`);
  prompts.push("Challenge this week's priorities.");
  return prompts.slice(0, 5);
}