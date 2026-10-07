import type { PresenceState } from "./types";

export type AmbientProject = {
  name: string;
  progress?: number;
  status?: string;
  blockers?: string[];
};

export type AmbientInsight = {
  severity?: "info" | "attention" | "urgent";
};

export type AmbientSignal = {
  label: string;
  value: string;
};

export type AmbientSummary = {
  statusLabel: string;
  statusText: string;
  focusText: string;
  recommendedAction: string;
  signals: AmbientSignal[];
};

export function summarizeAmbientState({
  currentFocus,
  presence,
  projects,
  insights,
}: {
  currentFocus?: string;
  presence?: PresenceState;
  projects?: AmbientProject[];
  insights?: AmbientInsight[];
}): AmbientSummary {
  const activeProjects = (projects ?? []).filter(
    (project) => !["idea", "paused", "abandoned"].includes(project.status ?? ""),
  );

  const topProject = [...activeProjects].sort(
    (left, right) => (right.progress ?? 0) - (left.progress ?? 0),
  )[0];

  const blockerCount = activeProjects.reduce(
    (count, project) => count + (project.blockers?.length ?? 0),
    0,
  );

  const attentionCount = (insights ?? []).filter(
    (insight) => insight.severity === "attention" || insight.severity === "urgent",
  ).length;

  const focusText = currentFocus?.trim() || topProject?.name || "Set a primary focus";

  let statusLabel = "Calm";
  let statusText = "Chief is waiting for your next cue.";

  if (presence === "listening") {
    statusLabel = "Focused";
    statusText = "Chief is tracking the current work and listening for the next signal.";
  } else if (presence === "thinking") {
    statusLabel = "Processing";
    statusText = "Chief is reconciling the board and choosing the highest-leverage move.";
  } else if (presence === "speaking") {
    statusLabel = "In motion";
    statusText = "Chief is moving on the current brief and keeping the plan narrow.";
  }

  const recommendedAction =
    blockerCount > 0
      ? `There are ${blockerCount} blocker${blockerCount === 1 ? "" : "s"} to confirm and resolve before the next move. Keep the plan narrow and confirm the blocker before continuing.`
      : presence === "thinking"
        ? "The current brief is stable. Move the next highest-leverage task and keep scope tight."
        : "The flow looks steady. Keep the current focus and avoid scope drift.";

  const signals: AmbientSignal[] = [
    {
      label: "High leverage",
      value: topProject ? `${topProject.name} • ${topProject.progress ?? 0}%` : "No active project",
    },
    {
      label: "Attention",
      value: `${attentionCount} signal${attentionCount === 1 ? "" : "s"}`,
    },
    {
      label: "Focus",
      value: focusText,
    },
  ];

  return {
    statusLabel,
    statusText,
    focusText,
    recommendedAction,
    signals,
  };
}
