const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('leonbosDesktop', {
    platform: process.platform,
    window: {
        minimize: () => ipcRenderer.invoke('leonbos-window:minimize'),
        toggleMaximize: () => ipcRenderer.invoke('leonbos-window:toggle-maximize'),
        close: () => ipcRenderer.invoke('leonbos-window:close')
    }
});
