"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// ── Expose a minimal, safe API surface to the renderer ─────────────────────
// No raw IPC channel names are exposed — only typed helper functions.
contextBridge.exposeInMainWorld("electronAPI", {
  /** Current OS platform string, e.g. "win32" */
  platform: process.platform,

  /** Open a URL in the user's default browser */
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  /** True when running inside Electron desktop */
  isDesktop: true,
});
