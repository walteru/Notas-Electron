const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const PROYECTOS_DIR = path.join(__dirname, 'proyectos');

if (!fs.existsSync(PROYECTOS_DIR)) {
    fs.mkdirSync(PROYECTOS_DIR);
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 700,
        backgroundColor: '#121212',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile('src/index.html');
    // win.webContents.openDevTools(); // Descomentar para debug

    win.webContents.on('context-menu', (event, params) => {
        const template = [];

        if (params.isEditable) {
            template.push(
                { label: 'Deshacer', role: 'undo', enabled: params.editFlags.canUndo },
                { label: 'Rehacer', role: 'redo', enabled: params.editFlags.canRedo },
                { type: 'separator' },
                { label: 'Cortar', role: 'cut', enabled: params.editFlags.canCut },
                { label: 'Copiar', role: 'copy', enabled: params.editFlags.canCopy },
                { label: 'Pegar', role: 'paste', enabled: params.editFlags.canPaste },
                { type: 'separator' },
                { label: 'Seleccionar todo', role: 'selectAll' }
            );
        } else if (params.selectionText && params.selectionText.trim().length > 0) {
            template.push(
                { label: 'Copiar', role: 'copy' },
                { type: 'separator' },
                { label: 'Seleccionar todo', role: 'selectAll' }
            );
        } else {
            template.push(
                { label: 'Seleccionar todo', role: 'selectAll' }
            );
        }

        Menu.buildFromTemplate(template).popup({ window: win });
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---

ipcMain.handle('get-projects', async () => {
    const files = fs.readdirSync(PROYECTOS_DIR);
    return files
        .filter(f => f.endsWith('.md'))
        .map(f => ({
            name: path.parse(f).name,
            path: f
        }))
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
});

ipcMain.handle('read-note', async (event, fileName) => {
    const filePath = path.join(PROYECTOS_DIR, fileName);
    return fs.readFileSync(filePath, 'utf-8');
});

ipcMain.handle('save-note', async (event, { fileName, content }) => {
    const filePath = path.join(PROYECTOS_DIR, fileName);
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
});

ipcMain.handle('delete-note', async (event, fileName) => {
    const filePath = path.join(PROYECTOS_DIR, fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
    }
    return false;
});

ipcMain.handle('search-notes', async (event, query) => {
    const files = fs.readdirSync(PROYECTOS_DIR).filter(f => f.endsWith('.md'));
    const results = [];
    const q = query.toLowerCase();

    for (const file of files) {
        const content = fs.readFileSync(path.join(PROYECTOS_DIR, file), 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            if (line.toLowerCase().includes(q)) {
                results.push({
                    file: path.parse(file).name,
                    fileName: file,
                    line: index + 1,
                    text: line.trim()
                });
            }
        });
    }
    return results;
});

ipcMain.handle('confirm-dialog', async (event, { title, message, buttons }) => {
    const result = await dialog.showMessageBox({
        type: 'question',
        buttons: buttons || ['Cancelar', 'Aceptar'],
        defaultId: 1,
        title: title || 'Confirmar',
        message: message || '¿Estás seguro?'
    });
    return result.response;
});
