import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { startServer } from './src/server.js'

function createWindow(loadUrl = 'http://localhost:3000') {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // load the local express server
  win.loadURL(loadUrl).catch(err => {
    console.error('Failed to load URL', loadUrl, err)
  })
}

app.whenReady().then(() => {
  // global handlers to surface errors
  function writeLog(msg) {
    try {
      const logDir = path.join(app.getPath('userData'))
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
      const logFile = path.join(logDir, 'app.log')
      const entry = `[${new Date().toISOString()}] ${typeof msg === 'string' ? msg : JSON.stringify(msg, Object.getOwnPropertyNames(msg))}`
      fs.appendFileSync(logFile, entry + '\n\n')
    } catch (e) {
      console.error('Failed to write log file', e)
    }
  }

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
    writeLog(`Unhandled Rejection at: ${String(reason)}\n${String(promise)}`)
  })
  process.on('uncaughtException', err => {
    console.error('Uncaught Exception:', err)
    writeLog(`Uncaught Exception: ${err && err.stack ? err.stack : String(err)}`)
  })

  // start express server first, then create the Electron window
  startServer().then(() => {
    createWindow('http://localhost:3000');
  }).catch(err => {
    console.error('Failed to start server', err)
    // load a local error page so the app window still opens
    const errorPage = `file://${path.join(__dirname, 'src', 'public', 'error.html')}`
    createWindow(errorPage)
  })

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
