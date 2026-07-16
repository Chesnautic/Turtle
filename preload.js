const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('turtleAPI', {
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  exportWav: (arrayBuffer, suggestedName) =>
    ipcRenderer.invoke('save-wav', { buffer: arrayBuffer, suggestedName }),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window-toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
});
