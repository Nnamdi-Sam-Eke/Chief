import test from "node:test";
import assert from "node:assert/strict";

import { detectAmbientContext } from "./ambient-context.ts";

test("detectAmbientContext selects focused or blocked mode from the live board", () => {
  const focused = detectAmbientContext({
    currentFocus: "Ship the launch brief",
    presence: "listening",
    blockerCount: 1,
    insightCount: 2,
    activeProjectCount: 3,
  });

  assert.equal(focused.mode, "blocked");
  assert.ok(focused.guidance.includes("launch brief"));
  assert.ok(focused.recommendedAction.includes("blocker"));

  const calm = detectAmbientContext({
    currentFocus: "Ship the launch brief",
    presence: "idle",
    blockerCount: 0,
    insightCount: 0,
    activeProjectCount: 0,
  });

  assert.equal(calm.mode, "ready");
  assert.ok(calm.guidance.includes("ready"));
});
