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
  ipcMain.handle('orders:delete', (_, id) => db.deleteOrder(id));
  ipcMain.handle('orders:getNextInvoiceNumber', () => db.getNextInvoiceNumber());

  // STAFF
  ipcMain.handle('staff:getAll', () => db.getAllStaff());
  ipcMain.handle('staff:create', (_, data) => db.createStaff(data));
  ipcMain.handle('staff:update', (_, data) => db.updateStaff(data));
  ipcMain.handle('staff:delete', (_, id) => db.deleteStaff(id));
 ipcMain.handle('expenseCategories:getAll', () => db.getExpenseCategories());
  ipcMain.handle('expenseCategories:create', (_, data) => db.createExpenseCategory(data));
  ipcMain.handle('expenses:getAll', (_, filters) => db.getExpenses(filters));
  ipcMain.handle('expenses:create', (_, data) => db.createExpense(data));
  ipcMain.handle('expenses:update', (_, data) => db.updateExpense(data));
  ipcMain.handle('expenses:delete', (_, id) => db.deleteExpense(id));
  ipcMain.handle('expenses:getSummary', (_, filters) => db.getExpenseSummary(filters));

  // INVESTMENTS
  ipcMain.handle('investors:getAll', (_, filters) => db.getInvestors(filters));
  ipcMain.handle('investors:getById', (_, id) => db.getInvestorById(id));
  ipcMain.handle('investors:create', (_, data) => db.createInvestor(data));
  ipcMain.handle('investors:update', (_, data) => db.updateInvestor(data));
  ipcMain.handle('investors:delete', (_, id) => db.deleteInvestor(id));
  ipcMain.handle('investments:getAll', (_, filters) => db.getInvestments(filters));
  ipcMain.handle('investments:create', (_, data) => db.createInvestment(data));
  ipcMain.handle('investments:update', (_, data) => db.updateInvestment(data));
  ipcMain.handle('investments:delete', (_, id) => db.deleteInvestment(id));
  ipcMain.handle('investments:getSummary', (_, filters) => db.getInvestmentSummary(filters));
  ipcMain.handle('finance:getOverview', () => db.getFinanceOverview());

    // KITCHEN INVENTORY
  ipcMain.handle('kitchen:getDashboard', () => db.getKitchenDashboard());
  ipcMain.handle('kitchen:ingredients:getAll', () => db.getKitchenIngredients());
  ipcMain.handle('kitchen:ingredients:create', (_, data) => db.createKitchenIngredient(data));
  ipcMain.handle('kitchen:ingredients:update', (_, data) => db.updateKitchenIngredient(data));
  ipcMain.handle('kitchen:ingredients:delete', (_, id) => db.deleteKitchenIngredient(id));
  ipcMain.handle('kitchen:purchases:getAll', (_, filters) => db.getKitchenPurchases(filters));
  ipcMain.handle('kitchen:purchases:create', (_, data) => db.createKitchenPurchase(data));
  ipcMain.handle('kitchen:vouchers:getAll', (_, filters) => db.getKitchenIssueVouchers(filters));
  ipcMain.handle('kitchen:vouchers:create', (_, data) => db.createKitchenIssueVoucher(data));
  ipcMain.handle('kitchen:vouchers:approve', (_, data) => db.approveKitchenIssueVoucher(data.id, data.actor));
  ipcMain.handle('kitchen:waste:getAll', (_, filters) => db.getKitchenWaste(filters));
  ipcMain.handle('kitchen:waste:create', (_, data) => db.createKitchenWaste(data));
  ipcMain.handle('kitchen:recipes:getAll', () => db.getKitchenRecipes());
  ipcMain.handle('kitchen:recipes:save', (_, data) => db.saveKitchenRecipe(data));
  ipcMain.handle('kitchen:recipes:delete', (_, id) => db.deleteKitchenRecipe(id));
  ipcMain.handle('kitchen:movements:getAll', (_, filters) => db.getKitchenStockMovements(filters));
  ipcMain.handle('kitchen:reports:getAll', (_, filters) => db.getKitchenReports(filters));
  ipcMain.handle('kitchen:audit:getAll', (_, filters) => db.getKitchenAuditLogs(filters));
  // DASHBOARD
  ipcMain.handle('dashboard:getStats', () => db.getDashboardStats());
  ipcMain.handle('dashboard:getRevenueChart', (_, days) => db.getRevenueChart(days));
  ipcMain.handle('dashboard:getTopProducts', () => db.getTopProducts());

  // REPORTS
  ipcMain.handle('reports:getSales', (_, filters) => db.getSalesReport(filters));
  ipcMain.handle('reports:resetRevenue', () => db.resetRevenue());
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
    ipcMain.handle('printer:getSettings', () => printerService.getPrinterSettings());
  ipcMain.handle('printer:saveSettings', (_, printerName) => printerService.savePrinterSettings(printerName));
  ipcMain.handle('printer:printReceipt', (_, data) => printerService.printReceipt(data));
  ipcMain.handle('printer:testPrint', () => printerService.testPrint());
}
