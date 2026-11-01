const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

let mainWindow;
let store;
const isDevelopment = process.env.NODE_ENV === 'development';

// Dedicated data directory (XDG data home), separate from Electron's userData
const dataDir =
	process.env.PROGRESSO_DATA_DIR ||
	path.join(
		process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'),
		'progresso'
	);
const dataFile = path.join(dataDir, 'progresso-data.json');

// One-time migration from the old location (~/.config/progresso/config.json)
function migrateOldData() {
	const oldFile = path.join(app.getPath('userData'), 'config.json');
	if (!fs.existsSync(dataFile) && fs.existsSync(oldFile)) {
		fs.mkdirSync(dataDir, { recursive: true });
		fs.copyFileSync(oldFile, dataFile);
		console.log(`Migrated data from ${oldFile} to ${dataFile}`);
	}
}

async function getStore() {
	if (!store) {
		const ElectronStore = (await import('electron-store')).default;
		store = new ElectronStore({
			cwd: dataDir,
			name: 'progresso-data', // -> progresso-data.json
		});
	}
	return store;
}

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1500,
		height: 900,
		minWidth: 1000,
		minHeight: 650,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
		},
		icon: path.join(__dirname, 'build', 'icons', '64x64.png'),
	});

	if (isDevelopment) mainWindow.webContents.openDevTools();
	mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
	mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.on('save-data', async (_event, key, data) => {
	(await getStore()).set(key, data);
});

ipcMain.handle('load-data', async (_event, key) => {
	return (await getStore()).get(key, null);
});

app.whenReady().then(() => {
	Menu.setApplicationMenu(null);
	migrateOldData();
	createWindow();
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
	if (mainWindow === null) createWindow();
});
