
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const os = require("os");
const path = require("path");

let mainWindow;

function sendUpdateStatus(status, message, progress = null) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:status", {
      status,
      message,
      progress
    });
  }
}

function setupUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => {
    sendUpdateStatus("checking", "Söker efter uppdateringar...");
  });

  autoUpdater.on("update-available", info => {
    sendUpdateStatus(
      "available",
      `Version ${info.version} hittades. Laddar ner...`
    );
  });

  autoUpdater.on("update-not-available", () => {
    sendUpdateStatus("latest", "Du har redan den senaste versionen!");
  });

  autoUpdater.on("download-progress", info => {
    sendUpdateStatus(
      "downloading",
      `Laddar ner uppdatering: ${Math.round(info.percent)} %`,
      Math.round(info.percent)
    );
  });

  autoUpdater.on("update-downloaded", info => {
    sendUpdateStatus(
      "downloaded",
      `Version ${info.version} är redo att installeras.`
    );
  });

  autoUpdater.on("error", error => {
    sendUpdateStatus("error", "Uppdateringsfel: " + error.message);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1450,
    height: 920,
    minWidth: 950,
    minHeight: 650,
    backgroundColor: "#080b18",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile("index.html");
}

ipcMain.handle("system:info", async () => {
  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();

  const cpuStart = cpus.map(cpu => ({
    idle: cpu.times.idle,
    total: Object.values(cpu.times).reduce((a, b) => a + b, 0)
  }));

  await new Promise(resolve => setTimeout(resolve, 350));

  const cpuEnd = os.cpus();
  let idleDifference = 0;
  let totalDifference = 0;

  cpuEnd.forEach((cpu, index) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    idleDifference += cpuStart[index].idle - cpu.times.idle;
    totalDifference += cpuStart[index].total - total;
  });

  let cpuUsage = 0;

  if (totalDifference > 0) {
    cpuUsage = Math.round(
      100 * (1 - idleDifference / totalDifference)
    );
  }

  let gpuName = "Information inte tillgänglig";

  try {
    const gpu = await app.getGPUInfo("basic");
    const devices = gpu.gpuDevice || [];

    if (devices.length > 0) {
      gpuName = devices
        .map(device => device.deviceString)
        .filter(Boolean)
        .join(", ");
    }
  } catch {
    gpuName = "Kunde inte läsa GPU-information";
  }

  return {
    cpu: Math.max(0, Math.min(100, cpuUsage)),
    cpuName: cpus[0]?.model || "Okänd processor",
    ramTotal: totalMemory,
    ramUsed: totalMemory - freeMemory,
    ramFree: freeMemory,
    ramPercent: Math.round(
      ((totalMemory - freeMemory) / totalMemory) * 100
    ),
    gpu: gpuName,
    platform: os.platform(),
    release: os.release(),
    computer: os.hostname(),
    cores: cpus.length
  };
});

ipcMain.handle("game:launch", async (_event, id) => {
  if (!/^\d+$/.test(String(id))) {
    throw new Error("Ogiltigt Steam-spel-ID");
  }

  await shell.openExternal(`steam://run/${id}`);
  return true;
});

ipcMain.handle("external:open", async (_event, url) => {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      throw new Error("Endast HTTPS-länkar tillåts");
    }

    await shell.openExternal(parsed.href);
    return true;
  } catch {
    throw new Error("Länken kunde inte öppnas");
  }
});

ipcMain.handle("update:check", async () => {
  if (!app.isPackaged) {
    sendUpdateStatus(
      "error",
      "Uppdateringar fungerar först i den installerade appen."
    );
    return false;
  }

  try {
    await autoUpdater.checkForUpdates();
    return true;
  } catch (error) {
    sendUpdateStatus("error", error.message);
    throw error;
  }
});

ipcMain.handle("update:install", () => {
  if (!app.isPackaged) return false;

  autoUpdater.quitAndInstall();
  return true;
});

app.whenReady().then(() => {
  setupUpdater();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
