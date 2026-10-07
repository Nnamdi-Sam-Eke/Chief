export type AmbientMode = "focused" | "blocked" | "ready";

export function detectAmbientContext({
  currentFocus,
  presence,
  blockerCount,
  insightCount,
  activeProjectCount,
}: {
  currentFocus?: string;
  presence?: string;
  blockerCount?: number;
  insightCount?: number;
  activeProjectCount?: number;
}): {
  mode: AmbientMode;
  guidance: string;
  recommendedAction: string;
} {
  const focusText = currentFocus?.trim() || "the current brief";

  if ((blockerCount ?? 0) > 0) {
    return {
      mode: "blocked",
      guidance: `The board is still in repair mode. Chief sees a blocker in the path of ${focusText}.`,
      recommendedAction: "Confirm the blocker before expanding scope or dispatching a new task.",
    };
  }

  if (presence === "thinking" || (insightCount ?? 0) > 0) {
    return {
      mode: "focused",
      guidance: `Chief is working through the current brief: ${focusText}.`,
      recommendedAction: "Keep the focus narrow and avoid adding new work while the plan is resolving.",
    };
  }

  if ((activeProjectCount ?? 0) > 0) {
    return {
      mode: "focused",
      guidance: `The system is ready for the next move without drift. Current emphasis is ${focusText}.`,
      recommendedAction: "Keep this focus; the next action should be the highest-leverage step, not the easiest one.",
    };
  }

  return {
    mode: "ready",
    guidance: `Chief is ready for a new brief. No active blocker is present and the system is clear to receive a new objective.`,
    recommendedAction: "Choose the next meaningful goal and keep the plan explicit before execution.",
  };
}
