// preload.js
// Currently empty but kept for future secure IPC between renderer and main
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  // add safe APIs here later
})
