import { spawn } from "node:child_process";

const DEV_URL = "http://127.0.0.1:8080/";

async function devServerIsReady() {
  try {
    const response = await fetch(DEV_URL, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

if (await devServerIsReady()) {
  console.log("[dev] Vite is already running on http://localhost:8080");
  process.exit(0);
}

const child = spawn(
  process.execPath,
  ["scripts/with-app-env.mjs", "vite", "dev", "--host", "0.0.0.0", "--port", "8080"],
  { stdio: "inherit", shell: false },
);

child.on("error", (error) => {
  console.error("[dev] failed to start Vite:", error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
