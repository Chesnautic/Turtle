const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const path = require('path');

let mainWindow = null;

const WINDOW_WIDTH = 240;
const WINDOW_HEIGHT = 420;

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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
