import type { CommitmentStatus, InsightSeverity, Lifecycle } from "@/lib/companion/types";

export function lifecycleTone(status: Lifecycle): "default" | "ok" | "warn" | "danger" | "solid" {
  if (status === "building" || status === "growing" || status === "launched") return "ok";
  if (status === "paused" || status === "validating") return "warn";
  if (status === "abandoned") return "danger";
  if (status === "committed") return "solid";
  return "default";
}

export function severityTone(s: InsightSeverity) {
  if (s === "urgent") return "danger" as const;
  if (s === "attention") return "warn" as const;
  return "default" as const;
}

export function commitmentTone(s: CommitmentStatus) {
  if (s === "done") return "ok" as const;
  if (s === "dropped") return "default" as const;
  return "warn" as const;
}

export const LOOP = [
  "Observe",
  "Understand",
  "Remember",
  "Decide",
  "Propose",
  "Execute",
  "Learn",
] as const;
