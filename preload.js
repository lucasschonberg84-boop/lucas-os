
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lucasOS", {
  getSystemInfo: () => ipcRenderer.invoke("system:info"),

  launchGame: id =>
    ipcRenderer.invoke("game:launch", String(id)),

  openExternal: url =>
    ipcRenderer.invoke("external:open", url),

  checkForUpdates: () =>
    ipcRenderer.invoke("update:check"),

  installUpdate: () =>
    ipcRenderer.invoke("update:install"),

  onUpdateStatus: callback => {
    const listener = (_event, data) => callback(data);

    ipcRenderer.on("update:status", listener);

    return () => {
      ipcRenderer.removeListener("update:status", listener);
    };
  }
});
