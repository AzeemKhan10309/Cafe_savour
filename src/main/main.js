const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// Detect dev mode: if launched via `npm start` concurrently, webpack-dev-server runs on 3000
const isDev = !app.isPackaged;

let mainWindow;
let db, printerService, reportService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
    },
    show: false,
    backgroundColor: '#0F0F1A',
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const devURL = 'http://localhost:3000';
  const prodIndexPath = path.join(__dirname, '../..', 'dist', 'index.html');
  if (isDev) {
    // In dev mode, retry loading until webpack-dev-server is ready
    const tryLoad = () => {
      mainWindow.loadURL(devURL).catch(() => {
        setTimeout(tryLoad, 1000);
      });
    };
    tryLoad();
    // Open DevTools after a short delay
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools();
      }
    }, 3000);
  } else {
    mainWindow.loadFile(prodIndexPath);
    }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
    if (isDev) {
      console.log('Page load failed, retrying in 2s...', errorDesc);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(devURL).catch(() => {});
        }
      }, 2000);
    } else {
      console.error('Production page load failed:', { errorCode, errorDesc, prodIndexPath });    }
  });
}

app.whenReady().then(() => {
  try {
    db = require('./database/db');
    printerService = require('./services/printerService');
    reportService = require('./services/reportService');
    db.initialize();
  } catch (e) {
    console.error('DB init error:', e);
  }

  createWindow();
  registerIPC();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

function registerIPC() {
  // AUTH
  ipcMain.handle('auth:login', (_, creds) => db.login(creds.username, creds.password));
  ipcMain.handle('auth:logout', () => ({ success: true }));

  // PRODUCTS
  ipcMain.handle('products:getAll', () => db.getAllProducts());
  ipcMain.handle('products:create', (_, data) => db.createProduct(data));
  ipcMain.handle('products:update', (_, data) => db.updateProduct(data));
  ipcMain.handle('products:delete', (_, id) => db.deleteProduct(id));
  ipcMain.handle('products:getLowStock', () => db.getLowStockProducts());

  // CATEGORIES
  ipcMain.handle('categories:getAll', () => db.getAllCategories());
  ipcMain.handle('categories:create', (_, data) => db.createCategory(data));
  ipcMain.handle('categories:delete', (_, id) => db.deleteCategory(id));

  // ORDERS
  ipcMain.handle('orders:create', (_, data) => db.createOrder(data));
  ipcMain.handle('orders:getAll', (_, filters) => db.getOrders(filters));
  ipcMain.handle('orders:getById', (_, id) => db.getOrderById(id));
  ipcMain.handle('orders:getNextInvoiceNumber', () => db.getNextInvoiceNumber());

  // STAFF
  ipcMain.handle('staff:getAll', () => db.getAllStaff());
  ipcMain.handle('staff:create', (_, data) => db.createStaff(data));
  ipcMain.handle('staff:update', (_, data) => db.updateStaff(data));
  ipcMain.handle('staff:delete', (_, id) => db.deleteStaff(id));

  // DASHBOARD
  ipcMain.handle('dashboard:getStats', () => db.getDashboardStats());
  ipcMain.handle('dashboard:getRevenueChart', (_, days) => db.getRevenueChart(days));
  ipcMain.handle('dashboard:getTopProducts', () => db.getTopProducts());

  // REPORTS
  ipcMain.handle('reports:getSales', (_, filters) => db.getSalesReport(filters));
  ipcMain.handle('reports:exportPDF', async (_, filters) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'sales-report.pdf',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (!result.canceled && result.filePath) return reportService.exportPDF(result.filePath, filters);
    return { cancelled: true };
  });
  ipcMain.handle('reports:exportExcel', async (_, filters) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'sales-report.xlsx',
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    });
    if (!result.canceled && result.filePath) return reportService.exportExcel(result.filePath, filters);
    return { cancelled: true };
  });

  // PRINTER
  ipcMain.handle('printer:listDevices', () => printerService.listUSBDevices());
  ipcMain.handle('printer:printReceipt', (_, data) => printerService.printReceipt(data));
  ipcMain.handle('printer:testPrint', () => printerService.testPrint());
}
