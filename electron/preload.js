const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pomodoroAPI", {
  getState: () => ipcRenderer.invoke("store:get"),
  setState: (data) => ipcRenderer.invoke("store:set", data),
  notify: (title, body) => ipcRenderer.invoke("notify:show", title, body),
});
