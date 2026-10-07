import test from "node:test";
import assert from "node:assert/strict";

import { resolveThemePreference, applyThemePreference } from "./theme.ts";

test("resolveThemePreference prefers explicit choices and falls back to dark", () => {
  assert.equal(resolveThemePreference("light"), "light");
  assert.equal(resolveThemePreference("dark"), "dark");
  assert.equal(resolveThemePreference("auto"), "dark");
  assert.equal(resolveThemePreference(null), "dark");
});

test("applyThemePreference sets the root data-theme attribute", () => {
  const original = globalThis.document;
  if (!original) {
    const fakeDocument = { documentElement: { setAttribute: () => {} } } as unknown as Document;
    const calls: string[] = [];
    const fakeRoot = { setAttribute: (name: string, value: string) => calls.push(`${name}:${value}`) };
    const fakeDoc = { documentElement: fakeRoot } as unknown as Document;
    Object.defineProperty(globalThis, "document", { value: fakeDoc, configurable: true });
    applyThemePreference("light");
    assert.deepEqual(calls, ["data-theme:light"]);
    Object.defineProperty(globalThis, "document", { value: original, configurable: true });
    return;
  }

  const calls: string[] = [];
  const previous = document.documentElement.setAttribute;
  document.documentElement.setAttribute = ((name: string, value: string) => {
    calls.push(`${name}:${value}`);
  }) as typeof document.documentElement.setAttribute;

  applyThemePreference("light");
  assert.deepEqual(calls, ["data-theme:light"]);

  document.documentElement.setAttribute = previous;
});
