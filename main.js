const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
let win;

function place(w, h) {
  const a = screen.getPrimaryDisplay().workArea;
  win.setBounds({ x: a.x + a.width - w, y: a.y + a.height - h, width: w, height: h });
}

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 340, height: 140, frame: false, transparent: true, resizable: false,
    hasShadow: false, alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), autoplayPolicy: 'no-user-gesture-required' }
  });
  win.setMinimumSize(1, 1);
  win.setAlwaysOnTop(true, 'screen-saver'); // fica acima de tudo
  win.loadFile('index.html');
});

ipcMain.on('resize', (_, w, h) => win && place(w, h));
ipcMain.on('attention', () => {          // popup de check-in
  if (win.isMinimized()) win.restore();
  win.showInactive();                    // aparece sem roubar o foco do teclado
  win.flashFrame(true);
  setTimeout(() => win.flashFrame(false), 2000);
});
ipcMain.on('minimize', () => win.minimize());
ipcMain.on('close', () => app.quit());
app.on('window-all-closed', () => app.quit());
