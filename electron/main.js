// Chief's desktop shell. This process owns NO application logic — Chief
// itself is the deployed/dev web app; this file just gives it a persistent
// floating presence outside a browser tab: a tray icon, an always-on-top
// transparent orb window (loads /orb — see src/routes/orb.tsx in the main
// app), a full window opened on demand, and a global keyboard shortcut.
//
// CONFIGURE BEFORE RUNNING: set CHIEF_APP_URL to wherever the app is
// actually reachable — your deployed Vercel URL for real use, or
// http://localhost:8080 for local development. In unpackaged development,
// the main project server is started automatically when this URL is down.
// Defaults to the deployed Vercel app if unset.
const { app, BrowserWindow, Tray, Menu, globalShortcut, screen, ipcMain, nativeImage, shell, desktopCapturer, dialog } = require("electron");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");

const APP_URL = process.env.CHIEF_APP_URL || "https://chief-rho.vercel.app";
const APP_ORIGIN = new URL(APP_URL).origin;
const APP_ROOT = path.resolve(__dirname, "..");
const ORB_SIZE = 64;
const GLOBAL_SHORTCUT = "CommandOrControl+Shift+C";
const SHOULD_START_HIDDEN = process.argv.includes("--hidden");
const SERVER_START_TIMEOUT_MS = 60000;

/** @type {BrowserWindow | null} */
let orbWindow = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
let backgroundPresenceEnabled = true;
let backgroundPresenceMenuItem = null;
let ownedDevServer = null;

function isLocalDevelopmentTarget() {
  const target = new URL(APP_URL);
  return !app.isPackaged &&
    (target.hostname === "localhost" || target.hostname === "127.0.0.1") &&
    target.port === "8080";
}

function isAppServerReady() {
  return new Promise((resolve) => {
    const target = new URL(APP_URL);
    const transport = target.protocol === "https:" ? https : http;
    const request = transport.get(target, (response) => {
      response.resume();
      resolve((response.statusCode ?? 500) < 500);
    });
    request.setTimeout(2000, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

function startLocalDevServer() {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  ownedDevServer = spawn(command, ["run", "dev"], {
    cwd: APP_ROOT,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: process.platform === "win32",
  });
  ownedDevServer.on("error", (error) => {
    console.error("[chief-shell] Could not start the local Chief server:", error);
  });
  ownedDevServer.unref();
}

function stopOwnedDevServer() {
  if (!ownedDevServer?.pid) return;
  const pid = ownedDevServer.pid;
  ownedDevServer = null;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGTERM");
    }
  } catch {
    // The server may already have exited.
  }
}

async function waitForAppServer() {
  if (await isAppServerReady()) return;
  if (isLocalDevelopmentTarget()) {
    console.info("[chief-shell] Starting the local Chief server before creating windows.");
    startLocalDevServer();
  }

  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isAppServerReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Chief's app server did not become available at ${APP_URL}.`);
}

function setOrbVisible(visible) {
  if (!orbWindow || orbWindow.isDestroyed()) return;
  if (visible) {
    orbWindow.show();
  } else {
    orbWindow.hide();
  }
}

function setBackgroundPresence(enabled) {
  const nextEnabled = Boolean(enabled);
  try {
    const settingsPath = path.join(app.getPath("userData"), "ambient-settings.json");
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({ backgroundPresenceEnabled: nextEnabled }), "utf8");
  } catch (error) {
    console.error("[chief-shell] Could not save background presence setting:", error);
    return false;
  }
  backgroundPresenceEnabled = nextEnabled;
  if (backgroundPresenceMenuItem) {
    backgroundPresenceMenuItem.checked = backgroundPresenceEnabled;
  }
  if (!mainWindow?.isVisible()) setOrbVisible(backgroundPresenceEnabled);
  return true;
}

function loadBackgroundPresence() {
  try {
    const settingsPath = path.join(app.getPath("userData"), "ambient-settings.json");
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    if (typeof settings.backgroundPresenceEnabled === "boolean") {
      return settings.backgroundPresenceEnabled;
    }
  } catch {
    // First launch has no per-device setting yet.
  }
  return true;
}

function createOrbWindow() {
  const { workAreaSize } = screen.getPrimaryDisplay();
  orbWindow = new BrowserWindow({
    width: ORB_SIZE,
    height: ORB_SIZE,
    x: workAreaSize.width - ORB_SIZE - 24,
    y: workAreaSize.height - ORB_SIZE - 24,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // The orb page needs mic access for the wake-word listener — granted
      // explicitly below via setPermissionRequestHandler, not by relaxing
      // this.
      contextIsolation: true,
    },
  });
  orbWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Forward mouse movement so the renderer can enable interaction only over
  // the orb's circular pixels; transparent corners stay click-through.
  orbWindow.setIgnoreMouseEvents(true, { forward: true });
  orbWindow.loadURL(`${APP_URL}/orb`);
  orbWindow.on("closed", () => {
    orbWindow = null;
  });
  if (!backgroundPresenceEnabled) orbWindow.hide();
}

function showMainWindow() {
  setOrbVisible(false);
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });
  mainWindow.loadURL(APP_URL);
  mainWindow.on("hide", () => {
    setOrbVisible(backgroundPresenceEnabled);
  });
  mainWindow.on("closed", () => {
    setOrbVisible(backgroundPresenceEnabled);
    mainWindow = null;
  });
}

function toggleMainWindow() {
  if (mainWindow?.isVisible()) {
    mainWindow.hide();
  } else {
    showMainWindow();
  }
}

function updateLaunchOnStartup(enabled) {
  if (typeof app.setLoginItemSettings !== "function") return;
  const settings = {
    openAtLogin: Boolean(enabled),
    openAsHidden: true,
    path: app.getPath("exe"),
    args: app.isPackaged ? [] : [app.getAppPath()],
  };
  app.setLoginItemSettings(settings);
  return Boolean(app.getLoginItemSettings(settings).openAtLogin) === Boolean(enabled);
}

function getLaunchOnStartup() {
  const settings = {
    path: app.getPath("exe"),
    args: app.isPackaged ? [] : [app.getAppPath()],
  };
  return Boolean(app.getLoginItemSettings?.(settings).openAtLogin);
}

function createTray() {
  // A blank/placeholder icon — Electron requires SOME image; swap in a real
  // one at electron/icon.png (16x16 or 32x32) before packaging a real build.
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon.isEmpty() ? nativeImage.createFromNamedImage("NSStatusAvailable", [16, 16]) : icon);
  tray.setToolTip("Chief");
  const menu = Menu.buildFromTemplate([
      { label: "Show Chief", click: showMainWindow },
      { label: "Launch on startup", type: "checkbox", checked: getLaunchOnStartup(), click: (item) => {
          updateLaunchOnStartup(item.checked);
        },
      },
      {
        label: "Background presence",
        type: "checkbox",
        checked: backgroundPresenceEnabled,
        click: (item) => setBackgroundPresence(item.checked),
        id: "background-presence",
      },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]);
  backgroundPresenceMenuItem = menu.getMenuItemById("background-presence");
  tray.setContextMenu(menu);
  tray.on("click", showMainWindow);
}

app.whenReady().then(async () => {
  backgroundPresenceEnabled = loadBackgroundPresence();
  // Chromium blocks mic/notification permission prompts for non-https
  // origins by default; the orb page needs both without a prompt UI (there's
  // no way to click "Allow" on a frameless always-on-top window a user
  // didn't summon). Scoped to this app's own window, not a blanket grant.
  const { session } = require("electron");
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    let trustedApp = false;
    try {
      trustedApp = new URL(webContents.getURL()).origin === new URL(APP_URL).origin;
    } catch {
      trustedApp = false;
    }
    callback(
      trustedApp &&
        (permission === "media" || permission === "notifications" || permission === "display-capture"),
    );
  });
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    const respond = (streams) => {
      try {
        callback(streams);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[chief-shell] Display capture was denied: ${message}`);
      }
    };

    if (!request.videoRequested || request.securityOrigin !== APP_ORIGIN) {
      respond({});
      return;
    }

    let source;
    try {
      const sources = await desktopCapturer.getSources({ types: ["screen"] });
      const primaryId = String(screen.getPrimaryDisplay().id);
      source = sources.find((candidate) => candidate.display_id === primaryId) ?? sources[0];
    } catch (error) {
      console.error("[chief-shell] Could not capture the requested screen:", error);
    }
    respond(source ? { video: source } : {});
  });

  try {
    await waitForAppServer();
  } catch (error) {
    stopOwnedDevServer();
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[chief-shell] ${message}`);
    dialog.showErrorBox("Chief could not start", message);
    app.quit();
    return;
  }

  createTray();
  createOrbWindow();

  const registered = globalShortcut.register(GLOBAL_SHORTCUT, toggleMainWindow);
  if (!registered) {
    console.warn(`[chief-shell] Could not register ${GLOBAL_SHORTCUT} — another app may already use it.`);
  }

  ipcMain.on("open-main", showMainWindow);
  ipcMain.on("open-external", (_event, url) => {
    if (typeof url === "string" && /^https?:\/\//.test(url)) {
      shell.openExternal(url);
    }
  });
  ipcMain.on("orb-move-by", (_event, dx, dy) => {
    if (!orbWindow) return;
    const [x, y] = orbWindow.getPosition();
    orbWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
  });
  ipcMain.on("orb-move-to", (_event, x, y) => {
    if (!orbWindow) return;
    orbWindow.setPosition(Math.round(x), Math.round(y));
  });
  ipcMain.on("orb-set-mouse-passthrough", (event, passthrough) => {
    if (!orbWindow || event.sender !== orbWindow.webContents) return;
    orbWindow.setIgnoreMouseEvents(Boolean(passthrough), { forward: true });
  });
  ipcMain.on("orb-get-bounds", (event) => {
    if (!orbWindow) {
      event.returnValue = { x: 0, y: 0, width: ORB_SIZE, height: ORB_SIZE };
      return;
    }
    const { x, y, width, height } = orbWindow.getBounds();
    event.returnValue = { x, y, width, height };
  });
  ipcMain.handle("get-launch-on-startup", getLaunchOnStartup);
  ipcMain.handle("set-launch-on-startup", (_event, enabled) =>
    updateLaunchOnStartup(enabled),
  );
  ipcMain.handle("get-background-presence", () => backgroundPresenceEnabled);
  ipcMain.handle("set-background-presence", (_event, enabled) =>
    setBackgroundPresence(enabled),
  );

  if (SHOULD_START_HIDDEN) {
    setOrbVisible(backgroundPresenceEnabled);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createOrbWindow();
  });
});

// Stay running in the tray — the whole point is that Chief persists after
// you close its window, unlike a normal app.
app.on("window-all-closed", (event) => {
  event.preventDefault();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopOwnedDevServer();
});
