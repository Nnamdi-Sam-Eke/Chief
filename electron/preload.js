const { contextBridge, ipcRenderer } = require("electron");

// Exposed as window.chief in the renderer (see src/routes/orb.tsx and
// src/lib/electron-bridge.ts). This bridge stays limited to the orb page's
// actual needs and external OAuth navigation.
contextBridge.exposeInMainWorld("chief", {
  openMain: () => ipcRenderer.send("open-main"),
  // OAuth providers block sign-in inside embedded app windows, so open the
  // flow in the user's real default browser instead.
  openExternal: (url) => ipcRenderer.send("open-external", url),
  moveBy: (dx, dy) => ipcRenderer.send("orb-move-by", dx, dy),
  moveTo: (x, y) => ipcRenderer.send("orb-move-to", x, y),
  getBounds: () => ipcRenderer.sendSync("orb-get-bounds"),
  setMousePassthrough: (passthrough) => ipcRenderer.send("orb-set-mouse-passthrough", passthrough),
  getLaunchOnStartup: () => ipcRenderer.invoke("get-launch-on-startup"),
  setLaunchOnStartup: (enabled) => ipcRenderer.invoke("set-launch-on-startup", enabled),
  getBackgroundPresence: () => ipcRenderer.invoke("get-background-presence"),
  setBackgroundPresence: (enabled) => ipcRenderer.invoke("set-background-presence", enabled),
});
