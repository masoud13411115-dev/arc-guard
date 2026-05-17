"use strict";

const { app, BrowserWindow, shell, Menu, ipcMain, nativeTheme } = require("electron");
const path = require("path");

// ── Security: disable Node.js integration in renderer ─────────────────────
app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");

// ── Window state ───────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  // Force dark mode to match the app's dark navy theme
  nativeTheme.themeSource = "dark";

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    title: "ARC Guard Manager",
    backgroundColor: "#0c1829",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // ── Load the built web assets ──────────────────────────────────────────
  // dist-web/ is populated by the copy:web build step and sits adjacent to electron/.
  const indexPath = path.join(__dirname, "..", "dist-web", "index.html");
  mainWindow.loadFile(indexPath).catch((err) => {
    console.error("[ARC Guard] Failed to load index.html:", err.message);
    mainWindow.webContents.loadURL(
      `data:text/html,<h2 style="font-family:sans-serif;padding:2rem;color:#e55">` +
      `Error loading ARC Guard Manager.<br><small>${err.message}</small></h2>`
    );
  });

  // ── Show window once ready (prevents white flash) ──────────────────────
  mainWindow.once("ready-to-show", () => mainWindow.show());

  // ── Open all external links in the default browser ─────────────────────
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Intercept navigation away from file:// — open in browser
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── Application menu ────────────────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "File",
      submenu: [
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(process.env.NODE_ENV !== "production"
          ? [{ type: "separator" }, { role: "toggleDevTools" }]
          : []),
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "ARC Guard Website",
          click: () => shell.openExternal("https://arcguard.app"),
        },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

// ── IPC handlers ────────────────────────────────────────────────────────────
ipcMain.handle("open-external", (_event, url) => {
  if (typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"))) {
    shell.openExternal(url);
  }
});

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  Menu.setApplicationMenu(buildMenu());
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── Security: block all permission requests except notifications ─────────────
app.on("web-contents-created", (_event, contents) => {
  contents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ["notifications", "geolocation", "media", "clipboard-read"];
    callback(allowed.includes(permission));
  });
});
