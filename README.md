# ☕ Brew & Co. Café POS System

A complete, production-ready Desktop POS system built with **Electron + React + SQLite + ESC/POS thermal printing**.

---

## 🏗️ Folder Structure

```
cafe-pos/
├── src/
│   ├── main/                          # Electron main process (Node.js)
│   │   ├── main.js                    # App entry, IPC handlers
│   │   ├── preload.js                 # Context bridge (secure API)
│   │   ├── database/
│   │   │   └── db.js                  # SQLite schema, queries, seed data
│   │   └── services/
│   │       ├── printerService.js      # ESC/POS USB thermal printing
│   │       └── reportService.js       # PDF/Excel export
│   └── renderer/                      # React frontend
│       ├── index.html
│       ├── index.jsx
│       ├── App.jsx                    # Root + Auth context + Toast
│       ├── styles/
│       │   └── global.css
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── POSPage.jsx            # Full billing screen
│       │   ├── DashboardPage.jsx      # KPIs + charts
│       │   ├── InventoryPage.jsx      # Product & category management
│       │   ├── StaffPage.jsx          # Staff & roles
│       │   └── ReportsPage.jsx        # Sales reports + export
│       └── components/
│           └── Layout.jsx             # Sidebar navigation
├── assets/
│   └── icon.ico                       # App icon
├── package.json
├── webpack.config.js
├── .babelrc
└── README.md
```

---

## 🗄️ Database Schema

```sql
-- Categories (Coffee, Tea, Food, Pastry, Cold Drinks, Specials)
categories (id, name, color, created_at)

-- Products with stock tracking
products (id, name, category_id, price, cost, stock, low_stock_threshold, image, description, active, created_at)

-- Staff with bcrypt passwords
staff (id, name, username, password, role[admin|manager|cashier], active, created_at)

-- Orders with split payment support
orders (id, invoice_number, staff_id, subtotal, discount, discount_type, tax_rate, tax_amount, total, payment_method, payment_details[JSON], notes, status, created_at)

-- Line items per order
order_items (id, order_id, product_id, product_name, price, cost, quantity, subtotal)

-- App settings (tax rate, café name, etc.)
settings (key, value)
```

**Demo Credentials:**
| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Manager | `manager` | `manager123` |
| Cashier | `cashier` | `cashier123` |

---

## 🖨️ Thermal Printer Setup (ESC/POS USB)

### Supported Printers
- Epson TM-T88 series (most popular)
- Star TSP series
- SNBC BTP-R580
- Xprinter XP-58/80 series
- Any USB printer supporting ESC/POS

### Windows Driver Setup
1. Connect printer via USB
2. Install manufacturer's driver OR use **Zadig** to install WinUSB driver:
   - Download Zadig from https://zadig.akeo.ie
   - Select your printer from the dropdown
   - Click **Install Driver** (choose WinUSB or libusb-win32)
3. Restart the application

### Linux Setup
```bash
# Add user to lp and dialout groups
sudo usermod -a -G lp,dialout $USER
sudo usermod -a -G plugdev $USER

# Create udev rule (replace 04b8 with your VID, 0202 with your PID)
echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="04b8", ATTRS{idProduct}=="0202", MODE="0666"' | sudo tee /etc/udev/rules.d/99-thermal-printer.rules
sudo udevadm control --reload-rules
```

### Finding Your Printer's VID/PID
```bash
# Windows (PowerShell)
Get-PnpDevice -Class USB | Where-Object {$_.FriendlyName -like "*printer*"}

# Linux
lsusb | grep -i printer
```

### Test Print
In the app, go to **Settings** or use the API in dev console:
```javascript
window.api.testPrint()
```

---

## 🚀 Installation & Development

### Prerequisites
- Node.js 18+ (https://nodejs.org)
- Windows 10/11 (for .exe build)
- Git

### Step 1: Install Dependencies
```bash
# Clone or extract the project
cd cafe-pos

# Install all dependencies
npm install

# If you see native module errors for better-sqlite3 or usb:
npm install --build-from-source better-sqlite3
npm install --build-from-source usb
```

### Step 2: Rebuild Native Modules for Electron
```bash
# Install electron-rebuild
npm install -g @electron/rebuild

# Rebuild all native modules for your Electron version
npx electron-rebuild

# OR using npm script (add to package.json scripts):
# "rebuild": "electron-rebuild -f -w better-sqlite3,usb,escpos-usb"
```

### Step 3: Run in Development Mode
```bash
npm start
# This starts webpack-dev-server on port 3000 + Electron
```

### Step 4: Verify Database
The SQLite database is created automatically at:
- **Windows:** `%APPDATA%\cafe-pos\cafepos.db`
- **Linux:** `~/.config/cafe-pos/cafepos.db`
- **macOS:** `~/Library/Application Support/cafe-pos/cafepos.db`

---

## 🏗️ Building Windows .exe Installer

### Step 1: Build React Bundle
```bash
npm run build
# Outputs to ./dist/
```

### Step 2: Create Installer
```bash
# Build Windows NSIS installer
npx electron-builder build --win

# Output: dist-electron/CafePOS Setup 1.0.0.exe
```

### Step 3: Installer Options
The NSIS installer includes:
- ✅ One-click or custom install directory
- ✅ Desktop shortcut creation
- ✅ Start menu entry
- ✅ Uninstaller
- ✅ Auto-start option

### Build for Multiple Targets
```bash
# Windows 64-bit installer + portable
npx electron-builder --win nsis portable

# Just portable .exe (no install needed)
npx electron-builder --win portable
```

### Code Signing (Optional for Production)
```bash
# Set environment variables
export CSC_LINK="path/to/certificate.pfx"
export CSC_KEY_PASSWORD="your-password"
npx electron-builder --win
```

---

## 📱 Features Overview

### POS Billing Screen
- [x] Product grid with category filter tabs
- [x] Search products in real-time
- [x] Add/remove items, adjust quantity
- [x] Apply flat or percentage discounts
- [x] Automatic tax calculation (configurable rate)
- [x] **Payment methods:** Cash, Card, QR, Split payment
- [x] Cash change calculation with quick-amount buttons
- [x] Auto-incrementing invoice numbers
- [x] USB thermal receipt printing (ESC/POS)
- [x] Order notes support
- [x] Stock decrements on sale

### Dashboard
- [x] Today's revenue, orders, monthly stats
- [x] vs. yesterday comparison
- [x] Revenue trend chart (7/14/30 days)
- [x] Daily order volume bar chart
- [x] Top selling products (last 30 days)
- [x] Low stock alerts panel

### Inventory Management
- [x] Add/Edit/Delete products
- [x] Category management with color coding
- [x] Stock level tracking
- [x] Low stock threshold alerts
- [x] Profit margin calculation per product
- [x] Stock value calculation

### Staff Management (Admin only)
- [x] Roles: Admin, Manager, Cashier
- [x] Secure bcrypt password hashing
- [x] Activate/Deactivate accounts
- [x] Role permissions overview
- [x] Protect admin routes from lower roles

### Reports
- [x] Daily/Weekly/Monthly date range selector
- [x] Filter by payment method
- [x] Revenue, cost, profit, margin calculations
- [x] Orders list with all details
- [x] Product sales breakdown
- [x] Payment method breakdown with bar charts
- [x] **Export to PDF** (jsPDF with autotable)
- [x] **Export to Excel** (xlsx with multiple sheets)

---

## ⚙️ Configuration

### Tax Rate
Edit in database directly or add a settings UI:
```sql
UPDATE settings SET value = '10' WHERE key = 'tax_rate';
```

### Café Info (appears on receipts)
```sql
UPDATE settings SET value = 'EAT & MEET CAFE' WHERE key = 'cafe_name';
UPDATE settings SET value = '19 KM Sheikhupura Lahore Road, Opposite PSO Petrol Pump' WHERE key = 'cafe_address';
UPDATE settings SET value = '+92 331 4566600' WHERE key = 'cafe_phone';
UPDATE settings SET value = 'Thank you for visiting EAT & MEET CAFE!' WHERE key = 'receipt_footer';
```

---

## 🔧 Troubleshooting

### "Cannot find module 'better-sqlite3'"
```bash
npx electron-rebuild -f -w better-sqlite3
```

### "No USB printer found"
1. Check printer is powered on and connected
2. Install WinUSB driver via Zadig
3. Run `window.api.listUSBDevices()` in DevTools console
4. Check Device Manager for driver issues

### Native module errors on Windows
```bash
# Install build tools
npm install -g windows-build-tools
# Or install Visual Studio Build Tools separately
```

### App won't start (white screen)
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000
# Kill process using it
taskkill /PID <pid> /F
```

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Desktop Shell | Electron 28 |
| Frontend | React 18 + React Router 6 |
| Bundler | Webpack 5 + Babel |
| Database | SQLite via better-sqlite3 |
| Charts | Recharts |
| Printer | escpos + escpos-usb (ESC/POS) |
| Auth | bcryptjs |
| PDF Export | jsPDF + jsPDF-autotable |
| Excel Export | SheetJS (xlsx) |
| Icons | Lucide React |
| Installer | electron-builder + NSIS |

---

## 📄 License
MIT - Use freely for commercial projects.
