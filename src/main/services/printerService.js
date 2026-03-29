const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

// ─── PRINT LOCK (QUEUE SYSTEM) ───────────────────────────────────────────────
let _printLock = false;
const _queue = [];

function acquireLock() {
  return new Promise((resolve) => {
    const tryLock = () => {
      if (!_printLock) {
        _printLock = true;
        resolve();
      } else {
        _queue.push(tryLock);
      }
    };
    tryLock();
  });
}

function releaseLock() {
  _printLock = false;
  if (_queue.length > 0) {
    const next = _queue.shift();
    next();
  }
}

// ─── PRINTER LIST ────────────────────────────────────────────────────────────
function listPrinters() {
  return new Promise((resolve) => {
    exec(
      'powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"',
      (err, stdout) => {
        if (err) return resolve([]);
        resolve(
          stdout
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean)
        );
      }
    );
  });
}

async function detectPrinter(PRINTER_NAME) {
  const printers = await listPrinters();
  if (!printers.length) return null;

  if (PRINTER_NAME && printers.includes(PRINTER_NAME)) {
    return PRINTER_NAME;
  }

  return printers[0]; // fallback
}

// ─── RAW PRINT (ESC/POS) ─────────────────────────────────────────────────────
function printRaw(printerName, text) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(
      os.tmpdir(),
      `receipt_${Date.now()}.bin`
    );

    const ESC = '\x1B';
    const GS  = '\x1D';

    const data =
      ESC + '@' +                 // Initialize
      ESC + 'a' + '\x01' +        // Center align
      text +
      '\n\n\n\n' +
      GS + 'V' + '\x41' + '\x10'; // Cut

    fs.writeFileSync(tempFile, data, 'binary');

    // 🔥 FIXED printer path
    const printerPath = `\\\\127.0.0.1\\${printerName}`;

    const cmd = `cmd /c copy /b "${tempFile}" "${printerPath}"`;

    let attempts = 0;

    const tryPrint = () => {
      attempts++;

      exec(cmd, { windowsHide: true }, (err, stdout) => {
        // Success case
        if (!err || (stdout && stdout.includes('file(s) copied'))) {
          cleanup();
          return setTimeout(() => resolve(true), 1200);
        }

        if (attempts < 3) {
          return setTimeout(tryPrint, 1500);
        }

        cleanup();
        reject(new Error('Printer not responding'));
      });
    };

    const cleanup = () => {
      try { fs.unlinkSync(tempFile); } catch {}
    };

    tryPrint();
  });
}

// ─── RECEIPT FORMAT ──────────────────────────────────────────────────────────
function formatReceipt(data) {
  const {
    cafe,
    invoice,
    items,
    tableName = '',
    subtotal = 0,
    discountAmount = 0,
    discountType = 'flat',
    discount = 0,
    taxRate = 0,
    taxAmount = 0,
    serviceRate = 0,
    serviceAmount = 0,
    total,
    paymentMethod,
    date,
  } = data;

  const line = '='.repeat(32);
  const dash = '-'.repeat(32);

  const ESC = '\x1B';
  const GS  = '\x1D';

  const padRight = (text, len) => text.toString().padEnd(len, ' ');
  const padLeft  = (text, len) => text.toString().padStart(len, ' ');

  // 🔥 FORMAT MONEY (IMPORTANT)
  const money = (v) => parseFloat(v || 0).toFixed(0);

  // ─── TITLE ───────────────────────────────
  const cafeName =
    ESC + 'E' + '\x01' +
    GS  + '!' + '\x11' +
    (cafe?.name || 'SAUDI CAFE HOUSE') +
    GS  + '!' + '\x00' +
    ESC + 'E' + '\x00';

  const thankYou =
    ESC + 'E' + '\x01' +
    GS  + '!' + '\x11' +
    '   Thank You Visit Again!   ' +
    GS  + '!' + '\x00' +
    ESC + 'E' + '\x00';

  // ─── HEADER ─────────────────────────────
  const header = [
    cafeName,
    'Sargodha Rd, Mangowal Garbi',
    'Ph:03466262146',
    line,
    `Invoice : ${invoice}`,
    tableName ? `Table   : ${tableName}` : '',
    `Date    : ${date}`,
    `Payment : ${paymentMethod?.toUpperCase()}`,
    line,
    padRight('Item', 16) + padLeft('Qty', 4) + padLeft('Rate', 6) + padLeft('Amt', 6),
    dash,
  ];

  // ─── ITEMS ──────────────────────────────
  const itemLines = items.map((i) => {
    return (
      padRight(i.product_name.substring(0, 16), 16) +
      padLeft(i.quantity, 4) +
      padLeft(money(i.price), 6) +
      padLeft(money(i.subtotal), 6)
    );
  });

  // ─── FOOTER ─────────────────────────────
    const discountLabel = discountType === 'percent'
    ? `Discount (${parseFloat(discount || 0).toFixed(0)}%)`
    : 'Discount';
const footer = [
  dash,
`Subtotal : ${money(subtotal)}`,
    discountAmount > 0 ? `${discountLabel} : -${money(discountAmount)}` : '',
    serviceAmount > 0  ? `Service Tax (${parseFloat(serviceRate || 0).toFixed(0)}%) : ${money(serviceAmount)}` : '',
    taxAmount > 0      ? `VAT Tax (${parseFloat(taxRate || 0).toFixed(0)}%) : ${money(taxAmount)}` : '',
    `Total    : ${money(total)}`,
    line,
    thankYou,
  ].filter(Boolean);

  return [...header, ...itemLines, ...footer].join('\n');
}

// ─── MAIN PRINT FUNCTION ─────────────────────────────────────────────────────
async function printReceipt(data, PRINTER_NAME = null) {
  await acquireLock();

  try {
    const printer = await detectPrinter(PRINTER_NAME);
    const text = formatReceipt(data);

    if (!printer) {
      console.log('No printer found');
      console.log(text);
      return { success: false, simulated: true };
    }

    // 🔥 PRINT 2 TIMES (FIXED)
    await printRaw(printer, text);
    await new Promise((res) => setTimeout(res, 800));
    await printRaw(printer, text);

    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    releaseLock();
  }
}

module.exports = {
  printReceipt,
  listPrinters,
};