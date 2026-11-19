const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { bindSmartSpectraIpc } = require('@smartspectra/node-sdk/main');
let win;
let consent = false;
app.commandLine.appendSwitch('disable-http-cache');
if (process.env.BREATHLINES_FAKE_CAMERA) {
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch(
    'use-file-for-fake-video-capture',
    path.resolve(process.env.BREATHLINES_FAKE_CAMERA),
  );
}
app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1400,
    height: 960,
    minWidth: 1040,
    minHeight: 740,
    backgroundColor: '#f4f0e7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: 'breathlines-memory',
    },
  });
  const s = win.webContents.session;
  const local = (wc) =>
    wc === win.webContents &&
    wc.getURL() ===
      require('node:url').pathToFileURL(path.join(__dirname, 'index.html'))
        .href;
  s.setPermissionRequestHandler((wc, p, cb, d) =>
    cb(
      consent &&
        local(wc) &&
        p === 'media' &&
        d.mediaTypes?.length === 1 &&
        d.mediaTypes[0] === 'video',
    ),
  );
  s.setPermissionCheckHandler(
    (wc, p, o, d) =>
      consent && local(wc) && p === 'media' && d.mediaType === 'video',
  );
  bindSmartSpectraIpc(win);
  const trusted = (event) =>
    event.sender === win.webContents &&
    event.senderFrame === win.webContents.mainFrame;
  ipcMain.handle('breathlines:consent', (event, value) => {
    if (trusted(event)) consent = value === true;
  });
  ipcMain.handle('breathlines:key', (event) =>
    trusted(event) ? process.env.SMARTSPECTRA_API_KEY || '' : '',
  );
  ipcMain.handle('breathlines:export', async (event, { type, data }) => {
    if (
      !trusted(event) ||
      !['png', 'html'].includes(type) ||
      typeof data !== 'string' ||
      data.length > 30_000_000
    )
      throw new Error('Invalid export');
    const result = await dialog.showSaveDialog(win, {
      defaultPath: `breath-manuscript.${type}`,
      filters: [{ name: type.toUpperCase(), extensions: [type] }],
    });
    if (result.canceled) return false;
    await fs.writeFile(
      result.filePath,
      type === 'png'
        ? Buffer.from(data.replace(/^data:image\/png;base64,/, ''), 'base64')
        : data,
    );
    return true;
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('console-message', (event) => {
    if (event.level >= 2) console.error(`[renderer] ${event.message}`);
  });
  win.webContents.on('did-finish-load', () =>
    console.log('Breathlines: consent screen ready; camera not requested.'),
  );
  win.loadFile(path.join(__dirname, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
