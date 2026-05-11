const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getProjects: () => ipcRenderer.invoke('get-projects'),
    readNote: (fileName) => ipcRenderer.invoke('read-note', fileName),
    saveNote: (data) => ipcRenderer.invoke('save-note', data),
    deleteNote: (fileName) => ipcRenderer.invoke('delete-note', fileName),
    searchNotes: (query) => ipcRenderer.invoke('search-notes', query),
    confirmDialog: (options) => ipcRenderer.invoke('confirm-dialog', options),
    quitApp: () => ipcRenderer.invoke('quit-app'),
    zoomIn: () => {
        const z = Math.min(3, webFrame.getZoomFactor() + 0.1);
        webFrame.setZoomFactor(z);
        return z;
    },
    zoomOut: () => {
        const z = Math.max(0.3, webFrame.getZoomFactor() - 0.1);
        webFrame.setZoomFactor(z);
        return z;
    },
    zoomReset: () => {
        webFrame.setZoomFactor(1);
        return 1;
    }
});
