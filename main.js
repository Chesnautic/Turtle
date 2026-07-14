const { app, BrowserWindow, ipcMain, Menu, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

const WINDOW_WIDTH = 264;
const WINDOW_HEIGHT = 480;

function createWindow() {
  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: screenWidth - WINDOW_WIDTH - 40,
    y: screenHeight - WINDOW_HEIGHT - 40,
    transparent: true,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Right-click context menu: quit, toggle click-through, always-on-top toggle, dev tools.
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
      label: 'Reset position',
      click: () => {
        if (!mainWindow) return;
        const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
        mainWindow.setPosition(sw - WINDOW_WIDTH - 40, sh - WINDOW_HEIGHT - 40);
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
