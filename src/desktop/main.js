const { app, BrowserWindow, Menu, Tray, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const WebUIServer = require('../../backend/server');

const APP_NAME = 'LeonBos';
const APP_VERSION = require('../../package.json').version;
const DEFAULT_PORT = 0;

let mainWindow = null;
let tray = null;
let uiServer = null;
let isQuitting = false;

function resolveAssetPath(...segments) {
    return path.join(__dirname, ...segments);
}

function getIconPath() {
    const icoPath = resolveAssetPath('icons', 'icon.ico');
    const pngPath = resolveAssetPath('icons', 'icon.png');
    return fs.existsSync(icoPath) ? icoPath : pngPath;
}

function getUserDataDatabasePath() {
    const dataDir = path.join(app.getPath('userData'), 'database');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'leonbos.db');
}

async function startUiServer() {
    process.env.LEONBOS_DB_PATH = getUserDataDatabasePath();
    uiServer = new WebUIServer(DEFAULT_PORT);
    await uiServer.start();
    return `http://127.0.0.1:${uiServer.port}`;
}

function createMainWindow(baseUrl) {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 1100,
        minHeight: 720,
        title: `${APP_NAME} ${APP_VERSION}`,
        icon: getIconPath(),
        show: false,
        backgroundColor: '#071725',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    mainWindow.loadURL(baseUrl);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

function showMainWindow() {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
}

function showAboutDialog() {
    dialog.showMessageBox(mainWindow || undefined, {
        type: 'info',
        title: `关于 ${APP_NAME}`,
        message: `${APP_NAME} ${APP_VERSION}`,
        detail: '企业级反指纹浏览器控制台\nOfficial Release Materials',
        buttons: ['确定']
    });
}

function createTray(baseUrl) {
    tray = new Tray(getIconPath());
    tray.setToolTip(`${APP_NAME} ${APP_VERSION}`);
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: `显示 ${APP_NAME}`, click: showMainWindow },
        { label: '关于 LeonBos', click: () => { showMainWindow(); mainWindow.loadURL(`${baseUrl}/about`); } },
        { type: 'separator' },
        { label: '退出', click: () => quitApp() }
    ]));
    tray.on('double-click', showMainWindow);
}

async function quitApp() {
    isQuitting = true;
    if (uiServer) {
        await uiServer.stop();
        uiServer = null;
    }
    app.quit();
}

async function bootstrap() {
    app.setName(APP_NAME);
    const baseUrl = await startUiServer();
    createMainWindow(baseUrl);
    createTray(baseUrl);
}

app.whenReady().then(bootstrap).catch((error) => {
    dialog.showErrorBox('LeonBos 启动失败', error && error.message ? error.message : String(error));
    app.quit();
});

app.on('window-all-closed', (event) => {
    event.preventDefault();
});

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('activate', () => {
    showMainWindow();
});

ipcMain.handle('leonbos-window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('leonbos-window:toggle-maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
        return false;
    }
    mainWindow.maximize();
    return true;
});

ipcMain.handle('leonbos-window:close', async () => {
    await quitApp();
});
