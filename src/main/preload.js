const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Auth
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // Products
  getProducts: () => ipcRenderer.invoke('products:getAll'),
  createProduct: (data) => ipcRenderer.invoke('products:create', data),
  updateProduct: (data) => ipcRenderer.invoke('products:update', data),
  deleteProduct: (id) => ipcRenderer.invoke('products:delete', id),
  getLowStockProducts: () => ipcRenderer.invoke('products:getLowStock'),

  // Categories
  getCategories: () => ipcRenderer.invoke('categories:getAll'),
  createCategory: (data) => ipcRenderer.invoke('categories:create', data),
  deleteCategory: (id) => ipcRenderer.invoke('categories:delete', id),

  // Orders
  createOrder: (data) => ipcRenderer.invoke('orders:create', data),
  getOrders: (filters) => ipcRenderer.invoke('orders:getAll', filters),
  getOrderById: (id) => ipcRenderer.invoke('orders:getById', id),
    deleteOrder: (id) => ipcRenderer.invoke('orders:delete', id),
  getNextInvoiceNumber: () => ipcRenderer.invoke('orders:getNextInvoiceNumber'),

  // Staff
  getStaff: () => ipcRenderer.invoke('staff:getAll'),
  createStaff: (data) => ipcRenderer.invoke('staff:create', data),
  updateStaff: (data) => ipcRenderer.invoke('staff:update', data),
  deleteStaff: (id) => ipcRenderer.invoke('staff:delete', id),
  // Expenses
  getExpenseCategories: () => ipcRenderer.invoke('expenseCategories:getAll'),
  createExpenseCategory: (data) => ipcRenderer.invoke('expenseCategories:create', data),
  getExpenses: (filters) => ipcRenderer.invoke('expenses:getAll', filters),
  createExpense: (data) => ipcRenderer.invoke('expenses:create', data),
  updateExpense: (data) => ipcRenderer.invoke('expenses:update', data),
  deleteExpense: (id) => ipcRenderer.invoke('expenses:delete', id),
  getExpenseSummary: (filters) => ipcRenderer.invoke('expenses:getSummary', filters),

  // Investments
    getInvestors: (filters) => ipcRenderer.invoke('investors:getAll', filters),
  getInvestorById: (id) => ipcRenderer.invoke('investors:getById', id),
  createInvestor: (data) => ipcRenderer.invoke('investors:create', data),
  updateInvestor: (data) => ipcRenderer.invoke('investors:update', data),
  deleteInvestor: (id) => ipcRenderer.invoke('investors:delete', id),
  getInvestments: (filters) => ipcRenderer.invoke('investments:getAll', filters),
  createInvestment: (data) => ipcRenderer.invoke('investments:create', data),
  updateInvestment: (data) => ipcRenderer.invoke('investments:update', data),
  deleteInvestment: (id) => ipcRenderer.invoke('investments:delete', id),
  getInvestmentSummary: (filters) => ipcRenderer.invoke('investments:getSummary', filters),
  getFinanceOverview: () => ipcRenderer.invoke('finance:getOverview'),

  // Dashboard
  getDashboardStats: () => ipcRenderer.invoke('dashboard:getStats'),
  getRevenueChart: (days) => ipcRenderer.invoke('dashboard:getRevenueChart', days),
  getTopProducts: () => ipcRenderer.invoke('dashboard:getTopProducts'),

  // Reports
  getSalesReport: (filters) => ipcRenderer.invoke('reports:getSales', filters),
  resetRevenue: () => ipcRenderer.invoke('reports:resetRevenue'),
  exportPDF: (filters) => ipcRenderer.invoke('reports:exportPDF', filters),
  exportExcel: (filters) => ipcRenderer.invoke('reports:exportExcel', filters),

  // Printer
  listUSBDevices: () => ipcRenderer.invoke('printer:listDevices'),
  printReceipt: (data) => ipcRenderer.invoke('printer:printReceipt', data),
  testPrint: () => ipcRenderer.invoke('printer:testPrint'),
});
