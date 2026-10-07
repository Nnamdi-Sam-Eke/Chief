import test from "node:test";
import assert from "node:assert/strict";

import { streamTextContent } from "./streaming.ts";

test("streamTextContent reveals text in incremental chunks", async () => {
  const seen: string[] = [];

  await streamTextContent("hello", (chunk) => seen.push(chunk), {
    intervalMs: 0,
    chunkSize: 2,
  });

  assert.deepEqual(seen, ["h", "he", "hel", "hell", "hello"]);
});
