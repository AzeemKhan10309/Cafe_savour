const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const { app }  = require('electron');

const dbPath = app
  ? path.join(app.getPath('userData'), 'cafepos.db')
  : path.join(__dirname, '../../../cafepos.db');

let db;

function initialize() {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createTables();
  migrateSchema();
    seedExpenseCategories();
  seedIfEmpty();
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#4F46E5',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      price REAL NOT NULL,
      cost REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      low_stock_threshold INTEGER DEFAULT 5,
      image TEXT,
      description TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'cashier',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      staff_id INTEGER REFERENCES staff(id),
      table_name TEXT DEFAULT '',
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      discount_type TEXT DEFAULT 'flat',
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      payment_details TEXT DEFAULT '{}',
      notes TEXT,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id),
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      cost REAL DEFAULT 0,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL
    );
        CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#4F46E5',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount >= 0),
      category_id INTEGER NOT NULL REFERENCES expense_categories(id),
      expense_date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      investor_name TEXT DEFAULT '',
      amount REAL NOT NULL CHECK(amount >= 0),
      investment_date TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('owner','external','loan')),
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_investments_date ON investments(investment_date);
    CREATE INDEX IF NOT EXISTS idx_investments_type ON investments(type);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}
function migrateSchema() {
  addColumnIfMissing('orders', 'table_name', "TEXT DEFAULT ''");
}

function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const hasCol = cols.some((c) => c.name === column);
  if (!hasCol) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM staff').get().c;
  if (count > 0) return;

  const staffStmt = db.prepare('INSERT INTO staff (name,username,password,role) VALUES (?,?,?,?)');
  staffStmt.run('Admin User',  'admin',   bcrypt.hashSync('admin123',   10), 'admin');
  staffStmt.run('Cashier Ali', 'cashier', bcrypt.hashSync('cashier123', 10), 'cashier');

  const setSetting = db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
  setSetting.run('cafe_name',      'Saudi Saver House');
  setSetting.run('cafe_address',   'Main Boulevard, Lahore, Pakistan');
  setSetting.run('cafe_phone',     '+92 300 0000000');
  setSetting.run('tax_rate',       '0');
  setSetting.run('receipt_footer', 'Thank you for visiting Saudi Saver House!');
  setSetting.run('currency',       'Rs.');
}

function seedExpenseCategories() {
  const categories = [
    ['Inventory', '#10B981'],
    ['Utilities', '#3B82F6'],
    ['Rent', '#F59E0B'],
    ['Staff', '#EC4899'],
    ['Maintenance', '#8B5CF6'],
    ['Marketing', '#06B6D4'],
    ['Other', '#6B7280'],
  ];
  const stmt = db.prepare('INSERT OR IGNORE INTO expense_categories (name,color) VALUES (?,?)');
  categories.forEach(([name, color]) => stmt.run(name, color));
}


function toISODate(value, fieldName) {
  if (!value) throw new Error(`${fieldName} is required.`);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`${fieldName} must be a valid date.`);
  return d.toISOString().split('T')[0];
}

function positiveAmount(value, fieldName = 'Amount') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${fieldName} must be greater than zero.`);
  return Math.round(n * 100) / 100;
}

function ensureText(value, fieldName, max = 120) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${fieldName} is required.`);
  if (text.length > max) throw new Error(`${fieldName} cannot exceed ${max} characters.`);
  return text;
}

function normalizeExpense(d) {
  const categoryId = Number.parseInt(d.category_id, 10);
  if (!Number.isInteger(categoryId)) throw new Error('Expense category is required.');
  const cat = db.prepare('SELECT id FROM expense_categories WHERE id=?').get(categoryId);
  if (!cat) throw new Error('Expense category does not exist.');
  return {
    id: d.id ? Number.parseInt(d.id, 10) : undefined,
    item_name: ensureText(d.item_name, 'Item name'),
    amount: positiveAmount(d.amount, 'Cost amount'),
    category_id: categoryId,
    expense_date: toISODate(d.expense_date, 'Expense date'),
    notes: String(d.notes || '').trim(),
  };
}

function normalizeInvestment(d) {
  const allowed = new Set(['owner', 'external', 'loan']);
  const type = String(d.type || '').trim();
  if (!allowed.has(type)) throw new Error('Investment type must be owner, external, or loan.');
  return {
    id: d.id ? Number.parseInt(d.id, 10) : undefined,
    investor_name: String(d.investor_name || '').trim(),
    amount: positiveAmount(d.amount, 'Investment amount'),
    investment_date: toISODate(d.investment_date, 'Investment date'),
    type,
    notes: String(d.notes || '').trim(),
  };
}

function buildDateFilter(alias, dateColumn, f = {}) {
  const parts = [];
  const params = [];
  const prefix = alias ? `${alias}.` : '';
  if (f.start_date) { parts.push(`DATE(${prefix}${dateColumn}) >= ?`); params.push(toISODate(f.start_date, 'Start date')); }
  if (f.end_date) { parts.push(`DATE(${prefix}${dateColumn}) <= ?`); params.push(toISODate(f.end_date, 'End date')); }
  return { where: parts.length ? ` AND ${parts.join(' AND ')}` : '', params };
}

// ─── EXPENSES ────────────────────────────────────────────────────────────────
function getExpenseCategories() {
  return db.prepare('SELECT * FROM expense_categories ORDER BY name').all() || [];
}

function createExpenseCategory(d) {
  const name = ensureText(d.name, 'Category name', 80);
  const color = String(d.color || '#4F46E5').trim();
  const r = db.prepare('INSERT INTO expense_categories (name,color) VALUES (?,?)').run(name, color);
  return { id: r.lastInsertRowid, name, color };
}

function getExpenses(f = {}) {
  let q = `
    SELECT e.*, c.name as category_name, c.color as category_color
    FROM expenses e
    JOIN expense_categories c ON e.category_id = c.id
    WHERE 1=1
  `;
  const p = [];
  const date = buildDateFilter('e', 'expense_date', f);
  q += date.where; p.push(...date.params);
  if (f.category_id) { q += ' AND e.category_id=?'; p.push(Number.parseInt(f.category_id, 10)); }
  q += ' ORDER BY e.expense_date DESC, e.id DESC';
  if (f.limit) { q += ' LIMIT ?'; p.push(Number.parseInt(f.limit, 10)); }
  return db.prepare(q).all(...p) || [];
}

function createExpense(data) {
  const d = normalizeExpense(data);
  const r = db.prepare(`
    INSERT INTO expenses (item_name, amount, category_id, expense_date, notes)
    VALUES (?,?,?,?,?)
  `).run(d.item_name, d.amount, d.category_id, d.expense_date, d.notes);
  return { success: true, id: r.lastInsertRowid };
}

function updateExpense(data) {
  const d = normalizeExpense(data);
  if (!d.id) throw new Error('Expense id is required.');
  const r = db.prepare(`
    UPDATE expenses
    SET item_name=?, amount=?, category_id=?, expense_date=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(d.item_name, d.amount, d.category_id, d.expense_date, d.notes, d.id);
  if (!r.changes) throw new Error('Expense not found.');
  return { success: true };
}

function deleteExpense(id) {
  const r = db.prepare('DELETE FROM expenses WHERE id=?').run(id);
  return { success: r.changes > 0, message: r.changes ? undefined : 'Expense not found' };
}

function getExpenseSummary(f = {}) {
  const date = buildDateFilter('e', 'expense_date', f);
  const scoped = `FROM expenses e WHERE 1=1${date.where}`;
  const params = date.params;
  const total = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM expenses e WHERE 1=1${date.where}`).get(...params).total || 0;
  const daily = db.prepare(`SELECT expense_date as period, COALESCE(SUM(amount),0) as total ${scoped} GROUP BY expense_date ORDER BY expense_date DESC LIMIT 31`).all(...params) || [];
  const monthly = db.prepare(`SELECT strftime('%Y-%m', expense_date) as period, COALESCE(SUM(amount),0) as total ${scoped} GROUP BY period ORDER BY period DESC LIMIT 24`).all(...params) || [];
  const yearly = db.prepare(`SELECT strftime('%Y', expense_date) as period, COALESCE(SUM(amount),0) as total ${scoped} GROUP BY period ORDER BY period DESC LIMIT 10`).all(...params) || [];
  const categories = db.prepare(`
    SELECT c.name, c.color, COALESCE(SUM(e.amount),0) as total, COUNT(e.id) as count
    FROM expense_categories c
    LEFT JOIN expenses e ON e.category_id = c.id${date.where}
    GROUP BY c.id
    HAVING total > 0
    ORDER BY total DESC
  `).all(...params) || [];
  return { total, daily, monthly, yearly, categories };
}

// ─── INVESTMENTS ─────────────────────────────────────────────────────────────
function getInvestments(f = {}) {
  let q = 'SELECT * FROM investments WHERE 1=1';
  const p = [];
  const date = buildDateFilter('', 'investment_date', f);
  q += date.where; p.push(...date.params);
  if (f.type) { q += ' AND type=?'; p.push(f.type); }
  q += ' ORDER BY investment_date DESC, id DESC';
  if (f.limit) { q += ' LIMIT ?'; p.push(Number.parseInt(f.limit, 10)); }
  return db.prepare(q).all(...p) || [];
}

function createInvestment(data) {
  const d = normalizeInvestment(data);
  const r = db.prepare(`
    INSERT INTO investments (investor_name, amount, investment_date, type, notes)
    VALUES (?,?,?,?,?)
  `).run(d.investor_name, d.amount, d.investment_date, d.type, d.notes);
  return { success: true, id: r.lastInsertRowid };
}

function updateInvestment(data) {
  const d = normalizeInvestment(data);
  if (!d.id) throw new Error('Investment id is required.');
  const r = db.prepare(`
    UPDATE investments
    SET investor_name=?, amount=?, investment_date=?, type=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(d.investor_name, d.amount, d.investment_date, d.type, d.notes, d.id);
  if (!r.changes) throw new Error('Investment not found.');
  return { success: true };
}

function deleteInvestment(id) {
  const r = db.prepare('DELETE FROM investments WHERE id=?').run(id);
  return { success: r.changes > 0, message: r.changes ? undefined : 'Investment not found' };
}

function getInvestmentSummary(f = {}) {
  const date = buildDateFilter('', 'investment_date', f);
  const total = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM investments WHERE 1=1${date.where}`).get(...date.params).total || 0;
  const byType = db.prepare(`
    SELECT type, COALESCE(SUM(amount),0) as total, COUNT(*) as count
    FROM investments
    WHERE 1=1${date.where}
    GROUP BY type
    ORDER BY total DESC
  `).all(...date.params) || [];
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', investment_date) as period, COALESCE(SUM(amount),0) as total
    FROM investments
    WHERE 1=1${date.where}
    GROUP BY period
    ORDER BY period DESC
    LIMIT 24
  `).all(...date.params) || [];
  return { total, byType, monthly };
}

function getFinanceOverview() {
  const sales = getSalesReport({});
  const totalExpenses = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM expenses').get().total || 0;
  const totalInvested = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM investments').get().total || 0;
  const monthExpenses = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE strftime('%Y-%m',expense_date)=strftime('%Y-%m','now')").get().total || 0;
  const monthInvestments = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM investments WHERE strftime('%Y-%m',investment_date)=strftime('%Y-%m','now')").get().total || 0;
  return {
    totalRevenue: sales.totalRevenue,
    grossProfit: sales.profit,
    totalExpenses,
    totalInvested,
    netProfitLoss: sales.profit - totalExpenses,
    monthExpenses,
    monthInvestments,
    recentExpenses: getExpenses({ limit: 5 }),
    recentInvestments: getInvestments({ limit: 5 }),
  };
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function login(username, password) {
  const user = db.prepare('SELECT * FROM staff WHERE username = ? AND active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) 
    return { success:false, message:'Invalid username or password' };
  const { password:_, ...safe } = user;
  return { success:true, user:safe };
}

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
function getAllProducts() {
  return db.prepare(`
    SELECT p.*, c.name as category_name, c.color as category_color 
    FROM products p 
    LEFT JOIN categories c ON p.category_id=c.id 
    WHERE p.active=1 
    ORDER BY c.name, p.name
  `).all() || [];
}

function createProduct(d) {
  const cat = db.prepare('SELECT id FROM categories WHERE id=?').get(d.category_id);
  if (!cat) throw new Error('Category does not exist.');
  const r = db.prepare(`
    INSERT INTO products (name,category_id,price,cost,stock,low_stock_threshold,description) 
    VALUES (?,?,?,?,?,?,?)
  `).run(d.name,d.category_id,d.price,d.cost||0,d.stock||0,d.low_stock_threshold||5,d.description||'');
  return {id:r.lastInsertRowid,...d};
}

function updateProduct(d) {
  db.prepare(`
    UPDATE products 
    SET name=?,category_id=?,price=?,cost=?,stock=?,low_stock_threshold=?,description=? 
    WHERE id=?
  `).run(d.name,d.category_id,d.price,d.cost,d.stock,d.low_stock_threshold,d.description,d.id);
  return d;
}

function deleteProduct(id) { 
  db.prepare('UPDATE products SET active=0 WHERE id=?').run(id); 
  return {success:true}; 
}

function getLowStockProducts() { 
  return db.prepare(`
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id=c.id 
    WHERE p.stock<=p.low_stock_threshold AND p.active=1
  `).all() || []; 
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
function getAllCategories() { 
  return db.prepare('SELECT * FROM categories ORDER BY name').all() || []; 
}

function createCategory(d) { 
  const r = db.prepare('INSERT INTO categories (name,color) VALUES (?,?)')
    .run(d.name, d.color || '#4F46E5'); 
  return { id: r.lastInsertRowid, ...d }; 
}

function deleteCategory(id) {
  // Check if ANY product (active or inactive) uses this category
const tx = db.transaction((categoryId) => {
    // Block deletion only if active products are still assigned.
    const activeCount = db
      .prepare('SELECT COUNT(*) as c FROM products WHERE category_id=? AND active=1')
      .get(categoryId).c;

    if (activeCount > 0) {
      throw new Error(`Cannot delete — ${activeCount} active product(s) still use this category`);
    }

    // Detach inactive products so FK constraints allow category removal.
    db.prepare('UPDATE products SET category_id=NULL WHERE category_id=? AND active=0').run(categoryId);

    db.prepare('DELETE FROM categories WHERE id=?').run(categoryId);
    return { success: true };
  });

  // Safe to delete
  return tx(id);
}

// ─── STAFF ────────────────────────────────────────────────────────────────────
function getAllStaff() { return db.prepare('SELECT id,name,username,role,active,created_at FROM staff ORDER BY name').all() || []; }

function createStaff(d) {
  const r = db.prepare('INSERT INTO staff (name,username,password,role) VALUES (?,?,?,?)')
    .run(d.name,d.username,bcrypt.hashSync(d.password,10),d.role);
  return {id:r.lastInsertRowid,name:d.name,username:d.username,role:d.role};
}

function updateStaff(d) {
  if (d.password) 
    db.prepare('UPDATE staff SET name=?,username=?,password=?,role=?,active=? WHERE id=?')
      .run(d.name,d.username,bcrypt.hashSync(d.password,10),d.role,d.active,d.id);
  else 
    db.prepare('UPDATE staff SET name=?,username=?,role=?,active=? WHERE id=?')
      .run(d.name,d.username,d.role,d.active,d.id);
  return d;
}

function deleteStaff(id) { db.prepare('UPDATE staff SET active=0 WHERE id=?').run(id); return {success:true}; }

// ─── ORDERS ───────────────────────────────────────────────────────────────────
function getNextInvoiceNumber() {
  const last = db.prepare('SELECT invoice_number FROM orders ORDER BY id DESC LIMIT 1').get();
  if (!last) return 'INV-1001';
  return `INV-${parseInt(last.invoice_number.replace('INV-',''))+1}`;
}

function createOrder(data) {
  if (!data.items || !data.items.length) 
    return { success:false, message:'Order must have at least one item.' };

  const tx = db.transaction(d => {
    const r = db.prepare(`
      INSERT INTO orders 
     (invoice_number,staff_id,table_name,subtotal,discount,discount_type,tax_rate,tax_amount,total,payment_method,payment_details,notes) 
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.invoice_number,
      d.staff_id,
      d.table_name || '',
      d.subtotal,
      d.discount||0,
      d.discount_type||'flat',
      d.tax_rate||0,
      d.tax_amount||0,
      d.total,
      d.payment_method,
      JSON.stringify(d.payment_details||{}),
      d.notes||''
    );

    const oid = r.lastInsertRowid;
    const is = db.prepare(`
      INSERT INTO order_items 
      (order_id,product_id,product_name,price,cost,quantity,subtotal) 
      VALUES (?,?,?,?,?,?,?)
    `);

    d.items.forEach(i => {
      const prod = db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(i.product_id);
      if (!prod) throw new Error(`Product with ID ${i.product_id} does not exist or is inactive.`);
      is.run(oid, prod.id, prod.name, i.price, i.cost||0, i.quantity, i.subtotal);
      db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(i.quantity, prod.id);
    });

    return oid;
  });

  try { return { success:true, id:tx(data) }; }
  catch(e) { return { success:false, message:e.message }; }
}

function getOrders(f={}) {
  let q = 'SELECT o.*, s.name as staff_name FROM orders o LEFT JOIN staff s ON o.staff_id=s.id WHERE 1=1';
  const p=[];
  if(f.start_date){q+=' AND DATE(o.created_at)>=?';p.push(f.start_date);}
  if(f.end_date)  {q+=' AND DATE(o.created_at)<=?';p.push(f.end_date);}
  if(f.payment_method){q+=' AND o.payment_method=?';p.push(f.payment_method);}
  q+=' ORDER BY o.created_at DESC';
  if(f.limit){q+=' LIMIT ?';p.push(f.limit);}
  return db.prepare(q).all(...p) || [];
}

function getOrderById(id) {
  const o = db.prepare('SELECT o.*, s.name as staff_name FROM orders o LEFT JOIN staff s ON o.staff_id=s.id WHERE o.id=?').get(id);
  if(!o) return null;
  o.items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(id) || [];
  return o;
}
function deleteOrder(id) {
  const tx = db.transaction((orderId) => {
    const order = db.prepare('SELECT id FROM orders WHERE id=?').get(orderId);
    if (!order) return { success: false, message: 'Order not found' };

    const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id=?').all(orderId) || [];
    const restockStmt = db.prepare('UPDATE products SET stock = stock + ? WHERE id=?');
    items.forEach((item) => {
      restockStmt.run(item.quantity, item.product_id);
    });

    db.prepare('DELETE FROM order_items WHERE order_id=?').run(orderId);
    db.prepare('DELETE FROM orders WHERE id=?').run(orderId);

    return { success: true };
  });

  return tx(id);
}
// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0];
  const yday  = new Date(); yday.setDate(yday.getDate()-1);
  return {
    todayStats: db.prepare('SELECT COUNT(*) as orders, SUM(total) as revenue FROM orders WHERE DATE(created_at)=?').get(today) || {orders:0,revenue:0},
    ystStats:   db.prepare('SELECT SUM(total) as revenue FROM orders WHERE DATE(created_at)=?').get(yday.toISOString().split('T')[0]) || {revenue:0},
    monthStats: db.prepare("SELECT SUM(total) as revenue, COUNT(*) as orders FROM orders WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now')").get() || {orders:0,revenue:0},
    lowStock:   db.prepare('SELECT COUNT(*) as c FROM products WHERE stock<=low_stock_threshold AND active=1').get().c || 0,
     monthExpenses: db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE strftime('%Y-%m',expense_date)=strftime('%Y-%m','now')").get().total || 0,
    totalInvested: db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM investments').get().total || 0,
  };
}

function getRevenueChart(days=7) {
  const data=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const ds=d.toISOString().split('T')[0];
    const row=db.prepare('SELECT SUM(total) as revenue, COUNT(*) as orders FROM orders WHERE DATE(created_at)=?').get(ds) || {revenue:0,orders:0};
    data.push({date:ds, revenue:row.revenue||0, orders:row.orders||0});
  }
  return data;
}

function getTopProducts(limit=10) {
  return db.prepare(`
    SELECT oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue 
    FROM order_items oi 
    JOIN orders o ON oi.order_id=o.id 
    WHERE DATE(o.created_at)>=DATE('now','-30 days') 
    GROUP BY oi.product_name 
    ORDER BY total_qty DESC 
    LIMIT ?
  `).all(limit) || [];
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────
function getSalesReport(f={}) {
  const orders = getOrders(f);
  const items  = orders.length 
    ? db.prepare(`
        SELECT oi.*, o.created_at 
        FROM order_items oi 
        JOIN orders o ON oi.order_id=o.id 
        WHERE oi.order_id IN (${orders.map(()=>'?').join(',')}) 
        ORDER BY oi.product_name
      `).all(...orders.map(o=>o.id)) 
    : [];
  const rev    = orders.reduce((s,o)=>s+o.total,0);
  const cost   = items.reduce((s,i)=>s+i.cost*i.quantity,0);
  return {orders, items, totalRevenue:rev, totalCost:cost, profit:rev-cost};
}
function resetRevenue() {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM orders').run();
  });
  tx();
  return { success: true };
}

module.exports = {
  initialize, login,
  getAllProducts, createProduct, updateProduct, deleteProduct, getLowStockProducts,
  getAllCategories, createCategory, deleteCategory,
  getAllStaff, createStaff, updateStaff, deleteStaff,
  getNextInvoiceNumber, createOrder, getOrders, getOrderById,
  deleteOrder,
  getExpenseCategories, createExpenseCategory, getExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary,
  getInvestments, createInvestment, updateInvestment, deleteInvestment, getInvestmentSummary, getFinanceOverview,
  getDashboardStats, getRevenueChart, getTopProducts,
  getSalesReport, resetRevenue,
};