#!/usr/bin/env node

/**
 * Run a command with `.grok/app-env.json` merged into its environment.
 *
 * Vite is launched directly through Node on Windows so paths containing
 * spaces (for example "C:\Users\DELL 7330") work correctly.
 */

import { spawn } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { constants as osConstants } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ENV_REL_PATH = ".grok/app-env.json";

const VITE_PREFIX = "VITE_";

/**
 * Parse an app-env document, keeping only VITE_-prefixed string entries.
 */
export function parseAppEnv(text) {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }

  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    return {};
  }

  const env = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (!key.startsWith(VITE_PREFIX)) continue;
    if (typeof value !== "string") continue;

    env[key] = value;
  }

  return env;
}

/**
 * Read the app environment file from the workspace root.
 */
export function readAppEnv(root) {
  try {
    return parseAppEnv(
      readFileSync(join(root, APP_ENV_REL_PATH), "utf8")
    );
  } catch {
    return {};
  }
}

/**
 * Explicit process.env values always override app-env.json values.
 */
export function mergeAppEnv(appEnv, processEnv) {
  return {
    ...appEnv,
    ...processEnv,
  };
}

/**
 * Convert a child's exit code/signal into a normal process exit status.
 */
export function exitStatusFromChild(code, signal) {
  if (signal) {
    const signo = osConstants.signals[signal];
    return 128 + (typeof signo === "number" ? signo : 1);
  }

  return code ?? 1;
}

/**
 * The workspace root.
 */
export function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

/**
 * Check whether this file is the main entry point.
 */
export function isMainModule(moduleUrl) {
  const entry = process.argv[1];

  if (!entry) return false;

  try {
    return realpathSync(entry) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}

/**
 * Spawn a command.
 *
 * On Windows, npm-installed CLI commands are normally `.cmd` shims.
 * For Vite, we bypass that shim completely and execute Vite's JavaScript
 * entry point with the current Node executable.
 *
 * This avoids Windows shell quoting issues and works correctly when the
 * project path contains spaces.
 */
function spawnCommand(command, args, options) {
  if (process.platform === "win32") {
    if (command === "vite") {
      const viteEntry = join(
        projectRoot(),
        "node_modules",
        "vite",
        "bin",
        "vite.js"
      );

      return spawn(
        process.execPath,
        [viteEntry, ...args],
        options
      );
    }
  }

  return spawn(command, args, options);
}

function main(argv) {
  const [command, ...args] = argv;

  if (!command) {
    console.error(
      "usage: node scripts/with-app-env.mjs <command> [args…]"
    );
    process.exit(2);
  }

  const env = mergeAppEnv(
    readAppEnv(projectRoot()),
    process.env
  );

  const child = spawnCommand(command, args, {
    stdio: "inherit",
    env,
  });

  /**
   * Forward termination signals to the child.
   */
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => {
      if (!child.killed) {
        child.kill(signal);
      }
    });
  }

  child.on("error", (err) => {
    console.error(
      `[with-app-env] failed to run ${command}:`,
      err?.message || err
    );

    process.exit(127);
  });

  child.on("exit", (code, signal) => {
    process.exit(
      exitStatusFromChild(code, signal)
    );
  });
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2));
}