const { app, BrowserWindow, ipcMain, Notification } = require("electron");
const path = require("path");
const Store = require("electron-store");

const store = new Store({
  name: "pomodoro-data",
  defaults: {
    timer: null,
    tasks: [],
    activeTaskId: null,
    settings: {},
  },
});

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 880,
    height: 600,
    minWidth: 760,
    minHeight: 480,
    title: "番茄钟",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("store:get", () => store.store);

ipcMain.handle("store:set", (_event, data) => {
  if (data && typeof data === "object") {
    store.store = data;
  }
  return store.store;
});

const APP_TITLE = "番茄钟";

ipcMain.handle("notify:show", (_event, title, body) => {
  if (Notification.isSupported()) {
    const n = new Notification({
      title: title || APP_TITLE,
      body: body || "",
    });
    n.show();
    return true;
  }
  return false;
});
