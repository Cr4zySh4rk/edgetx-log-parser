const { app, BrowserWindow } = require('electron')
const path = require('path')

// electron-reload disabled (causes immediate exit when files were recently modified)
// if (!app.isPackaged) { require('electron-reload')(...) }

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#1a1b26',
    title: 'EdgeTX Log Viewer',
  })

  win.on('closed', () => console.log('Window closed'))
  win.webContents.on('crashed', (e) => console.log('Renderer crashed:', e))
  win.webContents.on('did-fail-load', (e, code, desc) => console.log('Load failed:', code, desc))

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
