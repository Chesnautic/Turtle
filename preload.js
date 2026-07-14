const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('turtleAPI', {
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
});
