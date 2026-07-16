const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// v1.3.0: Turtle grew up from a small always-on-top floating pet into a
// real, resizable app window (the pond scene + three always-visible turtle
// tracks need real room). Still frameless for the custom look, but now
// behaves like a normal window: no alwaysOnTop, no visibleOnAllWorkspaces,
// resizable/maximizable, and centered on screen instead of pinned to a
// corner.
const WINDOW_WIDTH = 1000;
const WINDOW_HEIGHT = 760;
const WINDOW_MIN_WIDTH = 820;
const WINDOW_MIN_HEIGHT = 620;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    center: true,
    transparent: false,
    backgroundColor: '#12222a',
    frame: false,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    hasShadow: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Frameless-but-resizable means the OS gives us no minimize/maximize/close
// buttons — the renderer draws its own titlebar and calls these over IPC.
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-toggle-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// Right-click context menu: quit, toggle click-through, dev tools.
let clickThrough = false;

ipcMain.on('show-context-menu', (event) => {
  const template = [
    {
      label: clickThrough ? 'Disable click-through' : 'Enable click-through',
      click: () => {
        clickThrough = !clickThrough;
        if (mainWindow) {
          mainWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
        }
      },
    },
    { type: 'separator' },
    {
      label: mainWindow && mainWindow.isMaximized() ? 'Restore window' : 'Maximize window',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Turtle',
      click: () => app.quit(),
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: mainWindow });
});

// Export: renderer sends a rendered WAV as raw bytes, main shows a native
// "Save As" dialog and writes the file — keeps filesystem access out of the
// sandboxed renderer entirely.
ipcMain.handle('save-wav', async (event, { buffer, suggestedName }) => {
  if (!mainWindow) return { success: false };

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Turtle mix',
    defaultPath: suggestedName,
    filters: [{ name: 'WAV Audio', extensions: ['wav'] }],
  });

  if (canceled || !filePath) {
    return { success: false, canceled: true };
  }

  try {
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
