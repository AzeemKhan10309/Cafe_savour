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
        CREATE TABLE IF NOT EXISTS investors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      notes TEXT DEFAULT '',
      expected_monthly_amount REAL DEFAULT 0 CHECK(expected_monthly_amount >= 0),
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_investors_name ON investors(name);
    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      investor_id INTEGER REFERENCES investors(id) ON DELETE SET NULL,
      amount REAL NOT NULL CHECK(amount >= 0),
      investment_date TEXT NOT NULL,
        payment_method TEXT DEFAULT 'cash',
      type TEXT DEFAULT 'external',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_investments_date ON investments(investment_date);

    CREATE TABLE IF NOT EXISTS kitchen_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT DEFAULT 'Raw Material',
      unit TEXT NOT NULL DEFAULT 'KG',
      current_stock REAL DEFAULT 0 CHECK(current_stock >= 0),
      low_stock_threshold REAL DEFAULT 0 CHECK(low_stock_threshold >= 0),
      cost_per_unit REAL DEFAULT 0 CHECK(cost_per_unit >= 0),
      supplier TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_kitchen_ingredients_name ON kitchen_ingredients(name);
    CREATE INDEX IF NOT EXISTS idx_kitchen_ingredients_active ON kitchen_ingredients(active);

    CREATE TABLE IF NOT EXISTS kitchen_stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL REFERENCES kitchen_ingredients(id),
      movement_type TEXT NOT NULL,
      reference_type TEXT DEFAULT '',
      reference_id INTEGER,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      stock_before REAL NOT NULL DEFAULT 0,
      stock_after REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_by TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_kitchen_movements_ingredient ON kitchen_stock_movements(ingredient_id);
    CREATE INDEX IF NOT EXISTS idx_kitchen_movements_type ON kitchen_stock_movements(movement_type);
    CREATE INDEX IF NOT EXISTS idx_kitchen_movements_date ON kitchen_stock_movements(created_at);

    CREATE TABLE IF NOT EXISTS kitchen_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_number TEXT NOT NULL UNIQUE,
      purchase_date TEXT NOT NULL,
      supplier TEXT DEFAULT '',
      invoice_number TEXT DEFAULT '',
      total_amount REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_by TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS kitchen_purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES kitchen_purchases(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES kitchen_ingredients(id),
      quantity REAL NOT NULL CHECK(quantity > 0),
      unit TEXT NOT NULL,
      unit_cost REAL DEFAULT 0,
      subtotal REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS kitchen_issue_vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_number TEXT NOT NULL UNIQUE,
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      issued_by TEXT NOT NULL,
      received_by TEXT NOT NULL,
      department TEXT NOT NULL,
      notes TEXT DEFAULT '',
      approval_status TEXT DEFAULT 'pending',
      approved_by TEXT DEFAULT '',
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS kitchen_issue_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_id INTEGER NOT NULL REFERENCES kitchen_issue_vouchers(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES kitchen_ingredients(id),
      quantity REAL NOT NULL CHECK(quantity > 0),
      unit TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_kitchen_issue_status ON kitchen_issue_vouchers(approval_status);
    CREATE INDEX IF NOT EXISTS idx_kitchen_issue_date ON kitchen_issue_vouchers(issued_at);

    CREATE TABLE IF NOT EXISTS kitchen_waste_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      waste_number TEXT NOT NULL UNIQUE,
      ingredient_id INTEGER NOT NULL REFERENCES kitchen_ingredients(id),
      quantity REAL NOT NULL CHECK(quantity > 0),
      unit TEXT NOT NULL,
      reason TEXT NOT NULL,
      reported_by TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_kitchen_waste_date ON kitchen_waste_entries(created_at);

    CREATE TABLE IF NOT EXISTS kitchen_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      name TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id)
    );
    CREATE TABLE IF NOT EXISTS kitchen_recipe_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES kitchen_recipes(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES kitchen_ingredients(id),
      quantity REAL NOT NULL CHECK(quantity > 0),
      unit TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kitchen_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT DEFAULT '',
      actor TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_kitchen_audit_date ON kitchen_audit_logs(created_at);


    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}
function migrateSchema() {
  addColumnIfMissing('orders', 'table_name', "TEXT DEFAULT ''");
    addColumnIfMissing('investors', 'expected_monthly_amount', 'REAL DEFAULT 0');
  addColumnIfMissing('investors', 'active', 'INTEGER DEFAULT 1');
  addColumnIfMissing('investments', 'investor_id', 'INTEGER REFERENCES investors(id) ON DELETE SET NULL');
  addColumnIfMissing('investments', 'payment_method', "TEXT DEFAULT 'cash'");
    addColumnIfMissing('investments', 'type', "TEXT DEFAULT 'external'");
  backfillInvestorsFromLegacyInvestments();
  createInvestmentIndexes();
    seedKitchenIngredients();
}

function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const hasCol = cols.some((c) => c.name === column);
  if (!hasCol) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}
function tableHasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

function backfillInvestorsFromLegacyInvestments() {
  if (!tableHasColumn('investments', 'investor_name')) return;

  const legacyRows = db.prepare(`
    SELECT DISTINCT TRIM(investor_name) as name
    FROM investments
    WHERE investor_id IS NULL AND TRIM(COALESCE(investor_name,'')) <> ''
  `).all();
  const insertInvestor = db.prepare('INSERT OR IGNORE INTO investors (name, notes) VALUES (?, ?)');
  legacyRows.forEach((row) => insertInvestor.run(row.name, 'Imported from legacy investment records.'));

  db.prepare(`
    UPDATE investments
    SET investor_id = (SELECT id FROM investors WHERE investors.name = TRIM(investments.investor_name))
    WHERE investor_id IS NULL AND TRIM(COALESCE(investor_name,'')) <> ''
  `).run();
}

function createInvestmentIndexes() {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_investments_investor ON investments(investor_id);
    CREATE INDEX IF NOT EXISTS idx_investments_payment_method ON investments(payment_method);
  `);
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
function normalizeInvestor(d) {
  const expected = d.expected_monthly_amount === undefined || d.expected_monthly_amount === ''
    ? 0
    : Number(d.expected_monthly_amount);
  if (!Number.isFinite(expected) || expected < 0) throw new Error('Expected monthly amount cannot be negative.');
  return {
    id: d.id ? Number.parseInt(d.id, 10) : undefined,
    name: ensureText(d.name, 'Investor name', 120),
    notes: String(d.notes || '').trim(),
    expected_monthly_amount: Math.round(expected * 100) / 100,
  };
}

function normalizeInvestment(d) {
 const investorId = Number.parseInt(d.investor_id, 10);
  if (!Number.isInteger(investorId)) throw new Error('Investor is required.');
  const investor = db.prepare('SELECT id FROM investors WHERE id=?').get(investorId);
  if (!investor) throw new Error('Investor does not exist.');
  return {
    id: d.id ? Number.parseInt(d.id, 10) : undefined,
    investor_id: investorId,
    amount: positiveAmount(d.amount, 'Investment amount'),
    investment_date: toISODate(d.investment_date, 'Investment date'),
    payment_method: ensureText(d.payment_method || 'cash', 'Payment method', 80),
    notes: String(d.notes || '').trim(),
        type: String(d.type || 'external').trim() || 'external',
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

// ─── INVESTORS & INVESTMENTS ────────────────────────────────────────────────
function buildInvestmentFilters(f = {}, alias = 'i') {
  const parts = [];
  const params = [];
  const prefix = alias ? `${alias}.` : '';
  const date = buildDateFilter(alias, 'investment_date', f);
  if (date.where) {
    parts.push(date.where.replace(/^ AND /, ''));
    params.push(...date.params);
  }
  if (f.month) {
    parts.push(`strftime('%Y-%m', ${prefix}investment_date)=?`);
    params.push(String(f.month).slice(0, 7));
  }
  if (f.year) {
    parts.push(`strftime('%Y', ${prefix}investment_date)=?`);
    params.push(String(f.year));
  }
  if (f.investor_id) {
    parts.push(`${prefix}investor_id=?`);
    params.push(Number.parseInt(f.investor_id, 10));
  }
  if (f.payment_method) {
    parts.push(`${prefix}payment_method=?`);
    params.push(String(f.payment_method));
  }
  return { where: parts.length ? ` AND ${parts.join(' AND ')}` : '', params };
}

function getInvestors(f = {}) {
  let q = `
    SELECT inv.*,
      COALESCE(SUM(i.amount),0) as total_invested,
      COUNT(i.id) as investment_count,
      MAX(i.investment_date) as last_investment_date,
      COALESCE(SUM(CASE WHEN strftime('%Y-%m', i.investment_date)=strftime('%Y-%m','now') THEN i.amount ELSE 0 END),0) as invested_this_month
    FROM investors inv
    LEFT JOIN investments i ON i.investor_id = inv.id
    WHERE 1=1
  `;
  const params = [];
  if (f.search) {
    q += ' AND (inv.name LIKE ? OR inv.notes LIKE ?)';
    params.push(`%${f.search}%`, `%${f.search}%`);
  }
  q += ' GROUP BY inv.id ORDER BY inv.name COLLATE NOCASE';
  return db.prepare(q).all(...params).map((row) => ({
    ...row,
    outstanding_this_month: Math.max(0, Number(row.expected_monthly_amount || 0) - Number(row.invested_this_month || 0)),
  })) || [];
}

function getInvestorById(id) {
  return db.prepare('SELECT * FROM investors WHERE id=?').get(id) || null;
}

function createInvestor(data) {
  const d = normalizeInvestor(data);
  const r = db.prepare('INSERT INTO investors (name, notes, expected_monthly_amount) VALUES (?,?,?)')
    .run(d.name, d.notes, d.expected_monthly_amount);
  return { success: true, id: r.lastInsertRowid };
}

function updateInvestor(data) {
  const d = normalizeInvestor(data);
  if (!d.id) throw new Error('Investor id is required.');
  const r = db.prepare('UPDATE investors SET name=?, notes=?, expected_monthly_amount=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(d.name, d.notes, d.expected_monthly_amount, d.id);
  if (!r.changes) throw new Error('Investor not found.');
  return { success: true };
}

function deleteInvestor(id) {
  const linked = db.prepare('SELECT COUNT(*) as c FROM investments WHERE investor_id=?').get(id).c || 0;
  if (linked > 0) return { success: false, message: 'Investor has investment records. Delete or reassign those investments first.' };
  const r = db.prepare('DELETE FROM investors WHERE id=?').run(id);
  return { success: r.changes > 0, message: r.changes ? undefined : 'Investor not found' };
}

function getInvestments(f = {}) {
 let q = `
    SELECT i.*, inv.name as investor_name, inv.expected_monthly_amount
    FROM investments i
    LEFT JOIN investors inv ON inv.id = i.investor_id
    WHERE 1=1
  `;
  const filters = buildInvestmentFilters(f, 'i');
  q += filters.where;
  const p = [...filters.params];
  q += ' ORDER BY i.investment_date DESC, i.id DESC';
  if (f.limit) { q += ' LIMIT ?'; p.push(Number.parseInt(f.limit, 10)); }
  return db.prepare(q).all(...p) || [];
}

function createInvestment(data) {
  const d = normalizeInvestment(data);
  const r = db.prepare(`
 INSERT INTO investments (investor_id, amount, investment_date, payment_method, notes, type)
    VALUES (?,?,?,?,?,?)
  `).run(d.investor_id, d.amount, d.investment_date, d.payment_method, d.notes, d.type);
  return { success: true, id: r.lastInsertRowid };
}

function updateInvestment(data) {
  const d = normalizeInvestment(data);
  if (!d.id) throw new Error('Investment id is required.');
  const r = db.prepare(`
    UPDATE investments
    SET investor_id=?, amount=?, investment_date=?, payment_method=?, notes=?, type=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
  `).run(d.investor_id, d.amount, d.investment_date, d.payment_method, d.notes, d.type, d.id);
    if (!r.changes) throw new Error('Investment not found.');
  return { success: true };
}

function deleteInvestment(id) {
  const r = db.prepare('DELETE FROM investments WHERE id=?').run(id);
  return { success: r.changes > 0, message: r.changes ? undefined : 'Investment not found' };
}

function getInvestmentSummary(f = {}) {
   const filters = buildInvestmentFilters(f, 'i');
  const scoped = `FROM investments i LEFT JOIN investors inv ON inv.id = i.investor_id WHERE 1=1${filters.where}`;
  const params = filters.params;
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const currentYear = String(now.getFullYear());
  const total = db.prepare(`SELECT COALESCE(SUM(i.amount),0) as total ${scoped}`).get(...params).total || 0;
  const totalThisMonth = db.prepare(`SELECT COALESCE(SUM(i.amount),0) as total FROM investments i WHERE strftime('%Y-%m', i.investment_date)=?`).get(currentMonth).total || 0;
  const totalThisYear = db.prepare(`SELECT COALESCE(SUM(i.amount),0) as total FROM investments i WHERE strftime('%Y', i.investment_date)=?`).get(currentYear).total || 0;
  const byInvestor = db.prepare(`
    SELECT inv.id as investor_id, inv.name as investor_name, inv.expected_monthly_amount,
      COALESCE(SUM(i.amount),0) as total, COUNT(i.id) as count, MAX(i.investment_date) as last_investment_date
    ${scoped}
    GROUP BY inv.id
    HAVING inv.id IS NOT NULL AND total > 0
    ORDER BY total DESC
  `).all(...params) || [];
  const byType = db.prepare(`
SELECT i.type, COALESCE(SUM(i.amount),0) as total, COUNT(*) as count
    ${scoped}
    GROUP BY i.type
    ORDER BY total DESC
 `).all(...params) || [];
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', i.investment_date) as period, COALESCE(SUM(i.amount),0) as total
    ${scoped}
    GROUP BY period
    ORDER BY period DESC
    LIMIT 24
`).all(...params) || [];
  const yearly = db.prepare(`
    SELECT strftime('%Y', i.investment_date) as period, COALESCE(SUM(i.amount),0) as total
    ${scoped}
    GROUP BY period
    ORDER BY period DESC
    LIMIT 10
  `).all(...params) || [];
  const paymentMethods = db.prepare(`
    SELECT i.payment_method, COALESCE(SUM(i.amount),0) as total, COUNT(*) as count
    ${scoped}
    GROUP BY i.payment_method
    ORDER BY total DESC
  `).all(...params) || [];
  const outstanding = db.prepare(`
    SELECT inv.id as investor_id, inv.name as investor_name, inv.expected_monthly_amount,
      COALESCE(SUM(CASE WHEN strftime('%Y-%m', i.investment_date)=? THEN i.amount ELSE 0 END),0) as invested_this_month
    FROM investors inv
    LEFT JOIN investments i ON i.investor_id = inv.id
    WHERE inv.expected_monthly_amount > 0
    GROUP BY inv.id
    HAVING inv.expected_monthly_amount > invested_this_month
    ORDER BY (inv.expected_monthly_amount - invested_this_month) DESC
  `).all(currentMonth).map((row) => ({
    ...row,
    outstanding_amount: Number(row.expected_monthly_amount || 0) - Number(row.invested_this_month || 0),
  })) || [];

  return {
    total, totalThisMonth, totalThisYear, byInvestor, byType, monthly, yearly, paymentMethods, outstanding,
    totalInvestors: db.prepare('SELECT COUNT(*) as c FROM investors').get().c || 0,
  };
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
function seedKitchenIngredients() {
  const examples = [
    ['Chicken', 'Meat', 'KG', 10, 5], ['Meat', 'Meat', 'KG', 8, 4], ['Cheese', 'Dairy', 'KG', 5, 2],
    ['Flour', 'Dry Goods', 'KG', 25, 10], ['Vegetables', 'Produce', 'KG', 15, 5], ['Oil', 'Cooking', 'Liter', 20, 6],
    ['Milk', 'Dairy', 'Liter', 10, 4], ['Sugar', 'Dry Goods', 'KG', 15, 5], ['Sauces', 'Condiments', 'Liter', 6, 2],
    ['Packaging Materials', 'Packaging', 'Piece', 500, 100],
  ];
  const stmt = db.prepare('INSERT OR IGNORE INTO kitchen_ingredients (name, category, unit, current_stock, low_stock_threshold) VALUES (?,?,?,?,?)');
  examples.forEach((row) => stmt.run(...row));
}

function getNextKitchenNumber(table, column, prefix) {
  const last = db.prepare(`SELECT ${column} as value FROM ${table} ORDER BY id DESC LIMIT 1`).get();
  if (!last?.value) return `${prefix}-001`;
  const n = Number.parseInt(String(last.value).replace(`${prefix}-`, ''), 10) || 0;
  return `${prefix}-${String(n + 1).padStart(3, '0')}`;
}

function kitchenAudit(action, entityType, entityId, details = '', actor = '') {
  db.prepare('INSERT INTO kitchen_audit_logs (action, entity_type, entity_id, details, actor) VALUES (?,?,?,?,?)')
    .run(action, entityType, entityId || null, typeof details === 'string' ? details : JSON.stringify(details), actor || 'system');
}

function positiveQty(value, fieldName = 'Quantity') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${fieldName} must be greater than zero.`);
  return Math.round(n * 10000) / 10000;
}

function getKitchenIngredient(id) {
  const ingredient = db.prepare('SELECT * FROM kitchen_ingredients WHERE id=? AND active=1').get(id);
  if (!ingredient) throw new Error('Kitchen ingredient does not exist.');
  return ingredient;
}

function applyKitchenMovement({ ingredient_id, movement_type, reference_type, reference_id, quantity, unit, notes, actor }) {
  const ingredient = getKitchenIngredient(ingredient_id);
  const qty = positiveQty(quantity);
  const before = Number(ingredient.current_stock || 0);
  const sign = movement_type === 'purchase' || movement_type === 'adjustment_in' || movement_type === 'recipe_reversal' ? 1 : -1;
  const after = Math.round((before + (sign * qty)) * 10000) / 10000;
  if (after < -0.0001) throw new Error(`Insufficient stock for ${ingredient.name}. Available ${before} ${ingredient.unit}.`);
  db.prepare('UPDATE kitchen_ingredients SET current_stock=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(Math.max(0, after), ingredient.id);
  db.prepare(`
    INSERT INTO kitchen_stock_movements (ingredient_id,movement_type,reference_type,reference_id,quantity,unit,stock_before,stock_after,notes,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(ingredient.id, movement_type, reference_type || '', reference_id || null, qty, unit || ingredient.unit, before, Math.max(0, after), notes || '', actor || 'system');
}

function getKitchenDashboard() {
  return {
    totalIngredients: db.prepare('SELECT COUNT(*) as c FROM kitchen_ingredients WHERE active=1').get().c || 0,
    lowStock: db.prepare('SELECT COUNT(*) as c FROM kitchen_ingredients WHERE active=1 AND current_stock<=low_stock_threshold').get().c || 0,
    stockValue: db.prepare('SELECT COALESCE(SUM(current_stock * cost_per_unit),0) as total FROM kitchen_ingredients WHERE active=1').get().total || 0,
    pendingVouchers: db.prepare("SELECT COUNT(*) as c FROM kitchen_issue_vouchers WHERE approval_status='pending'").get().c || 0,
    monthPurchases: db.prepare("SELECT COALESCE(SUM(total_amount),0) as total FROM kitchen_purchases WHERE strftime('%Y-%m',purchase_date)=strftime('%Y-%m','now')").get().total || 0,
    monthConsumption: db.prepare("SELECT COALESCE(SUM(ABS(quantity)),0) as total FROM kitchen_stock_movements WHERE movement_type IN ('issue','recipe_deduction') AND strftime('%Y-%m',created_at)=strftime('%Y-%m','now')").get().total || 0,
    lowStockItems: getKitchenLowStockReport(),
    recentMovements: getKitchenStockMovements({ limit: 10 }),
  };
}

function getKitchenIngredients(includeInactive = false) {
  return db.prepare(`SELECT * FROM kitchen_ingredients ${includeInactive ? '' : 'WHERE active=1'} ORDER BY category, name`).all() || [];
}

function createKitchenIngredient(d) {
  const name = ensureText(d.name, 'Ingredient name', 120);
  const unit = ensureText(d.unit || 'KG', 'Unit', 40);
  const r = db.prepare(`
    INSERT INTO kitchen_ingredients (name,category,unit,current_stock,low_stock_threshold,cost_per_unit,supplier,notes)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(name, String(d.category || 'Raw Material').trim(), unit, Number(d.current_stock || 0), Number(d.low_stock_threshold || 0), Number(d.cost_per_unit || 0), String(d.supplier || '').trim(), String(d.notes || '').trim());
  kitchenAudit('create', 'ingredient', r.lastInsertRowid, { name, unit }, d.actor);
  return { success: true, id: r.lastInsertRowid };
}

function updateKitchenIngredient(d) {
  const id = Number.parseInt(d.id, 10);
  if (!id) throw new Error('Ingredient id is required.');
  const existing = getKitchenIngredient(id);
  db.prepare(`
    UPDATE kitchen_ingredients SET name=?,category=?,unit=?,low_stock_threshold=?,cost_per_unit=?,supplier=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(ensureText(d.name, 'Ingredient name', 120), String(d.category || 'Raw Material').trim(), ensureText(d.unit || existing.unit, 'Unit', 40), Number(d.low_stock_threshold || 0), Number(d.cost_per_unit || 0), String(d.supplier || '').trim(), String(d.notes || '').trim(), id);
  kitchenAudit('update', 'ingredient', id, d, d.actor);
  return { success: true };
}

function deleteKitchenIngredient(id) {
  db.prepare('UPDATE kitchen_ingredients SET active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id);
  kitchenAudit('delete', 'ingredient', id, 'Ingredient deactivated');
  return { success: true };
}

function createKitchenPurchase(d) {
  if (!d.items?.length) throw new Error('Purchase must include at least one ingredient.');
  const tx = db.transaction((data) => {
    const purchaseNumber = data.purchase_number || getNextKitchenNumber('kitchen_purchases', 'purchase_number', 'KP');
    const total = data.items.reduce((sum, item) => sum + (positiveQty(item.quantity) * Number(item.unit_cost || 0)), 0);
    const r = db.prepare(`INSERT INTO kitchen_purchases (purchase_number,purchase_date,supplier,invoice_number,total_amount,notes,created_by) VALUES (?,?,?,?,?,?,?)`)
      .run(purchaseNumber, toISODate(data.purchase_date || new Date(), 'Purchase date'), String(data.supplier || '').trim(), String(data.invoice_number || '').trim(), total, String(data.notes || '').trim(), data.actor || '');
    const pid = r.lastInsertRowid;
    const itemStmt = db.prepare('INSERT INTO kitchen_purchase_items (purchase_id,ingredient_id,quantity,unit,unit_cost,subtotal) VALUES (?,?,?,?,?,?)');
    data.items.forEach((item) => {
      const ing = getKitchenIngredient(item.ingredient_id);
      const qty = positiveQty(item.quantity);
      const cost = Number(item.unit_cost || 0);
      itemStmt.run(pid, ing.id, qty, item.unit || ing.unit, cost, qty * cost);
      if (cost > 0) db.prepare('UPDATE kitchen_ingredients SET cost_per_unit=?, supplier=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(cost, String(data.supplier || ing.supplier || '').trim(), ing.id);
      applyKitchenMovement({ ingredient_id: ing.id, movement_type: 'purchase', reference_type: 'purchase', reference_id: pid, quantity: qty, unit: item.unit || ing.unit, notes: `Purchase ${purchaseNumber}`, actor: data.actor });
    });
    kitchenAudit('create', 'purchase', pid, { purchaseNumber, total }, data.actor);
    return { success: true, id: pid, purchase_number: purchaseNumber };
  });
  return tx(d);
}

function getKitchenPurchases(f = {}) {
  let q = 'SELECT * FROM kitchen_purchases WHERE 1=1';
  const p = [];
  const date = buildDateFilter('', 'purchase_date', f); q += date.where; p.push(...date.params);
  q += ' ORDER BY purchase_date DESC, id DESC';
  return db.prepare(q).all(...p).map((purchase) => ({
    ...purchase,
    items: db.prepare('SELECT pi.*, i.name as ingredient_name FROM kitchen_purchase_items pi JOIN kitchen_ingredients i ON i.id=pi.ingredient_id WHERE pi.purchase_id=?').all(purchase.id) || [],
  })) || [];
}

function createKitchenIssueVoucher(d) {
  if (!d.items?.length) throw new Error('Issue voucher must include at least one ingredient.');
  const tx = db.transaction((data) => {
    const voucherNumber = data.voucher_number || getNextKitchenNumber('kitchen_issue_vouchers', 'voucher_number', 'KI');
    const status = data.approval_status || 'pending';
    const r = db.prepare(`INSERT INTO kitchen_issue_vouchers (voucher_number,issued_at,issued_by,received_by,department,notes,approval_status,approved_by,approved_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(voucherNumber, data.issued_at || new Date().toISOString(), ensureText(data.issued_by, 'Issued by'), ensureText(data.received_by, 'Received by'), ensureText(data.department, 'Department'), String(data.notes || '').trim(), status, status === 'approved' ? String(data.approved_by || data.actor || '').trim() : '', status === 'approved' ? new Date().toISOString() : null);
    const vid = r.lastInsertRowid;
    const itemStmt = db.prepare('INSERT INTO kitchen_issue_items (voucher_id,ingredient_id,quantity,unit) VALUES (?,?,?,?)');
    data.items.forEach((item) => {
      const ing = getKitchenIngredient(item.ingredient_id);
      const qty = positiveQty(item.quantity);
      itemStmt.run(vid, ing.id, qty, item.unit || ing.unit);
      if (status === 'approved') applyKitchenMovement({ ingredient_id: ing.id, movement_type: 'issue', reference_type: 'voucher', reference_id: vid, quantity: qty, unit: item.unit || ing.unit, notes: `Internal Issue Voucher ${voucherNumber}`, actor: data.actor });
    });
    kitchenAudit('create', 'issue_voucher', vid, { voucherNumber, status }, data.actor);
    return { success: true, id: vid, voucher_number: voucherNumber };
  });
  return tx(d);
}

function approveKitchenIssueVoucher(id, actor = '') {
  const tx = db.transaction((voucherId) => {
    const voucher = db.prepare('SELECT * FROM kitchen_issue_vouchers WHERE id=?').get(voucherId);
    if (!voucher) throw new Error('Voucher not found.');
    if (voucher.approval_status === 'approved') return { success: true };
    const items = db.prepare('SELECT * FROM kitchen_issue_items WHERE voucher_id=?').all(voucherId) || [];
    items.forEach((item) => applyKitchenMovement({ ingredient_id: item.ingredient_id, movement_type: 'issue', reference_type: 'voucher', reference_id: voucherId, quantity: item.quantity, unit: item.unit, notes: `Internal Issue Voucher ${voucher.voucher_number}`, actor }));
    db.prepare("UPDATE kitchen_issue_vouchers SET approval_status='approved', approved_by=?, approved_at=CURRENT_TIMESTAMP WHERE id=?").run(actor || 'admin', voucherId);
    kitchenAudit('approve', 'issue_voucher', voucherId, `Approved voucher ${voucher.voucher_number}`, actor);
    return { success: true };
  });
  return tx(id);
}

function getKitchenIssueVouchers(f = {}) {
  let q = 'SELECT * FROM kitchen_issue_vouchers WHERE 1=1';
  const p = [];
  const date = buildDateFilter('', 'issued_at', f); q += date.where; p.push(...date.params);
  if (f.approval_status) { q += ' AND approval_status=?'; p.push(f.approval_status); }
  q += ' ORDER BY issued_at DESC, id DESC';
  return db.prepare(q).all(...p).map((voucher) => ({
    ...voucher,
    items: db.prepare('SELECT ii.*, i.name as ingredient_name FROM kitchen_issue_items ii JOIN kitchen_ingredients i ON i.id=ii.ingredient_id WHERE ii.voucher_id=?').all(voucher.id) || [],
  })) || [];
}

function createKitchenWaste(d) {
  const tx = db.transaction((data) => {
    const ing = getKitchenIngredient(data.ingredient_id);
    const qty = positiveQty(data.quantity);
    const wasteNumber = data.waste_number || getNextKitchenNumber('kitchen_waste_entries', 'waste_number', 'KW');
    const r = db.prepare('INSERT INTO kitchen_waste_entries (waste_number,ingredient_id,quantity,unit,reason,reported_by,notes) VALUES (?,?,?,?,?,?,?)')
      .run(wasteNumber, ing.id, qty, data.unit || ing.unit, ensureText(data.reason, 'Waste reason'), ensureText(data.reported_by, 'Reported by'), String(data.notes || '').trim());
    applyKitchenMovement({ ingredient_id: ing.id, movement_type: 'waste', reference_type: 'waste', reference_id: r.lastInsertRowid, quantity: qty, unit: data.unit || ing.unit, notes: `Waste ${wasteNumber}: ${data.reason}`, actor: data.actor });
    kitchenAudit('create', 'waste', r.lastInsertRowid, { wasteNumber, ingredient: ing.name, qty }, data.actor);
    return { success: true, id: r.lastInsertRowid, waste_number: wasteNumber };
  });
  return tx(d);
}

function getKitchenWaste(f = {}) {
  let q = 'SELECT w.*, i.name as ingredient_name FROM kitchen_waste_entries w JOIN kitchen_ingredients i ON i.id=w.ingredient_id WHERE 1=1';
  const p = [];
  const date = buildDateFilter('w', 'created_at', f); q += date.where; p.push(...date.params);
  q += ' ORDER BY w.created_at DESC, w.id DESC';
  return db.prepare(q).all(...p) || [];
}

function saveKitchenRecipe(d) {
  const productId = Number.parseInt(d.product_id, 10);
  if (!productId) throw new Error('POS product is required.');
  const product = db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(productId);
  if (!product) throw new Error('POS product not found.');
  if (!d.items?.length) throw new Error('Recipe must include at least one ingredient.');
  const tx = db.transaction((data) => {
    const existing = db.prepare('SELECT * FROM kitchen_recipes WHERE product_id=?').get(productId);
    let recipeId = existing?.id;
    if (recipeId) {
      db.prepare('UPDATE kitchen_recipes SET name=?, active=1, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(data.name || `${product.name} Recipe`, String(data.notes || '').trim(), recipeId);
      db.prepare('DELETE FROM kitchen_recipe_items WHERE recipe_id=?').run(recipeId);
    } else {
      const r = db.prepare('INSERT INTO kitchen_recipes (product_id,name,notes) VALUES (?,?,?)').run(productId, data.name || `${product.name} Recipe`, String(data.notes || '').trim());
      recipeId = r.lastInsertRowid;
    }
    const stmt = db.prepare('INSERT INTO kitchen_recipe_items (recipe_id,ingredient_id,quantity,unit) VALUES (?,?,?,?)');
    data.items.forEach((item) => {
      const ing = getKitchenIngredient(item.ingredient_id);
      stmt.run(recipeId, ing.id, positiveQty(item.quantity), item.unit || ing.unit);
    });
    kitchenAudit('save', 'recipe', recipeId, { product: product.name }, data.actor);
    return { success: true, id: recipeId };
  });
  return tx(d);
}

function getKitchenRecipes() {
  return db.prepare(`
    SELECT r.*, p.name as product_name, p.price as product_price
    FROM kitchen_recipes r JOIN products p ON p.id=r.product_id
    WHERE r.active=1
    ORDER BY p.name
  `).all().map((recipe) => ({
    ...recipe,
    items: db.prepare('SELECT ri.*, i.name as ingredient_name FROM kitchen_recipe_items ri JOIN kitchen_ingredients i ON i.id=ri.ingredient_id WHERE ri.recipe_id=?').all(recipe.id) || [],
  })) || [];
}

function deleteKitchenRecipe(id) {
  db.prepare('UPDATE kitchen_recipes SET active=0 WHERE id=?').run(id);
  kitchenAudit('delete', 'recipe', id, 'Recipe deactivated');
  return { success: true };
}

function deductRecipesForOrder(orderId, items, actor = 'POS') {
  items.forEach((orderItem) => {
    const recipe = db.prepare('SELECT * FROM kitchen_recipes WHERE product_id=? AND active=1').get(orderItem.product_id);
    if (!recipe) return;
    const recipeItems = db.prepare('SELECT * FROM kitchen_recipe_items WHERE recipe_id=?').all(recipe.id) || [];
    recipeItems.forEach((ri) => {
      try {
        applyKitchenMovement({
          ingredient_id: ri.ingredient_id,
          movement_type: 'recipe_deduction',
          reference_type: 'order',
          reference_id: orderId,
          quantity: Number(ri.quantity) * Number(orderItem.quantity),
          unit: ri.unit,
          notes: `Auto recipe deduction for order #${orderId}`,
          actor,
        });
      } catch (error) {
        kitchenAudit('recipe_deduction_skipped', 'order', orderId, error.message, actor);
      }
    });
  });
}

function reverseRecipesForOrder(orderId, actor = 'POS') {
  const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id=?').all(orderId) || [];
  items.forEach((orderItem) => {
    const recipe = db.prepare('SELECT * FROM kitchen_recipes WHERE product_id=? AND active=1').get(orderItem.product_id);
    if (!recipe) return;
    const recipeItems = db.prepare('SELECT * FROM kitchen_recipe_items WHERE recipe_id=?').all(recipe.id) || [];
    recipeItems.forEach((ri) => {
      try {
        applyKitchenMovement({ ingredient_id: ri.ingredient_id, movement_type: 'recipe_reversal', reference_type: 'order_delete', reference_id: orderId, quantity: Number(ri.quantity) * Number(orderItem.quantity), unit: ri.unit, notes: `Recipe deduction reversed for deleted order #${orderId}`, actor });
      } catch (error) {
        kitchenAudit('recipe_reversal_skipped', 'order', orderId, error.message, actor);
      }
    });
  });
}

function getKitchenStockMovements(f = {}) {
  let q = 'SELECT m.*, i.name as ingredient_name, i.category FROM kitchen_stock_movements m JOIN kitchen_ingredients i ON i.id=m.ingredient_id WHERE 1=1';
  const p = [];
  const date = buildDateFilter('m', 'created_at', f); q += date.where; p.push(...date.params);
  if (f.movement_type) { q += ' AND m.movement_type=?'; p.push(f.movement_type); }
  if (f.ingredient_id) { q += ' AND m.ingredient_id=?'; p.push(Number.parseInt(f.ingredient_id, 10)); }
  q += ' ORDER BY m.created_at DESC, m.id DESC';
  if (f.limit) { q += ' LIMIT ?'; p.push(Number.parseInt(f.limit, 10)); }
  return db.prepare(q).all(...p) || [];
}

function getKitchenLowStockReport() {
  return db.prepare('SELECT * FROM kitchen_ingredients WHERE active=1 AND current_stock<=low_stock_threshold ORDER BY current_stock ASC, name').all() || [];
}

function getKitchenReports(f = {}) {
  return {
    stock: getKitchenIngredients(),
    consumption: getKitchenStockMovements({ ...f, movement_type: 'issue' }).concat(getKitchenStockMovements({ ...f, movement_type: 'recipe_deduction' })),
    internalIssues: getKitchenIssueVouchers(f),
    waste: getKitchenWaste(f),
    lowStock: getKitchenLowStockReport(),
    purchases: getKitchenPurchases(f),
    usage: db.prepare(`
      SELECT i.name as ingredient_name, i.unit, m.movement_type, COALESCE(SUM(m.quantity),0) as quantity
      FROM kitchen_stock_movements m JOIN kitchen_ingredients i ON i.id=m.ingredient_id
      WHERE m.movement_type IN ('issue','recipe_deduction','waste') ${buildDateFilter('m', 'created_at', f).where}
      GROUP BY i.id, m.movement_type
      ORDER BY i.name
    `).all(...buildDateFilter('m', 'created_at', f).params) || [],
  };
}

function getKitchenAuditLogs(f = {}) {
  let q = 'SELECT * FROM kitchen_audit_logs WHERE 1=1';
  const p = [];
  const date = buildDateFilter('', 'created_at', f); q += date.where; p.push(...date.params);
  q += ' ORDER BY created_at DESC, id DESC';
  if (f.limit) { q += ' LIMIT ?'; p.push(Number.parseInt(f.limit, 10)); }
  return db.prepare(q).all(...p) || [];
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
// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, value == null ? '' : String(value));
  return { success: true, key, value: value == null ? '' : String(value) };
}
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
deductRecipesForOrder(oid, d.items, d.staff_name || 'POS');
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
    reverseRecipesForOrder(orderId, 'POS order delete');
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
    getSetting, setSetting,
  getAllStaff, createStaff, updateStaff, deleteStaff,
  getNextInvoiceNumber, createOrder, getOrders, getOrderById,
  deleteOrder,
  getExpenseCategories, createExpenseCategory, getExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary,
    getInvestors, getInvestorById, createInvestor, updateInvestor, deleteInvestor,
  getInvestments, createInvestment, updateInvestment, deleteInvestment, getInvestmentSummary, getFinanceOverview,
  getDashboardStats, getRevenueChart, getTopProducts,
  getSalesReport, resetRevenue,
    getKitchenDashboard, getKitchenIngredients, createKitchenIngredient, updateKitchenIngredient, deleteKitchenIngredient,
  createKitchenPurchase, getKitchenPurchases,
  createKitchenIssueVoucher, approveKitchenIssueVoucher, getKitchenIssueVouchers,
  createKitchenWaste, getKitchenWaste,
  saveKitchenRecipe, getKitchenRecipes, deleteKitchenRecipe,
  getKitchenStockMovements, getKitchenLowStockReport, getKitchenReports, getKitchenAuditLogs,
};