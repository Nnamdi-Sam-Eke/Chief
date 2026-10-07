import test from "node:test";
import assert from "node:assert/strict";

import { summarizeAmbientState } from "./ambient-summary.ts";

test("summarizeAmbientState highlights focus, blockers, and the safe action", () => {
  const summary = summarizeAmbientState({
    currentFocus: "Polish the launch story for the portfolio site",
    presence: "listening",
    projects: [
      {
        name: "Portfolio refresh",
        progress: 82,
        status: "building",
        blockers: ["Need final copy approval"],
      },
      {
        name: "Chief launch prep",
        progress: 64,
        status: "exploring",
        blockers: [],
      },
    ],
    insights: [{ severity: "attention" }, { severity: "info" }],
  });

  assert.equal(summary.statusLabel, "Focused");
  assert.equal(summary.focusText, "Polish the launch story for the portfolio site");
  assert.ok(summary.recommendedAction.includes("confirm the blocker"));
  assert.ok(summary.signals.some((signal) => signal.label === "High leverage"));
  assert.ok(summary.signals.some((signal) => signal.label === "Attention"));
});
