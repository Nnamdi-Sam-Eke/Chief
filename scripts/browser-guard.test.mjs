import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { checkedOutputPath } from "./browser-guard.mjs";

test("checkedOutputPath accepts the current workspace even when it is not /workspace", () => {
  const root = process.cwd();
  const target = resolve(root, "screenshots", "portable-preview.png");
  assert.equal(checkedOutputPath(target, ["/workspace"]), target);
});
