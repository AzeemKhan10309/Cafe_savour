const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const printerSettings = require('./printerSettingsService');

const LOG_PREFIX = '[PrinterService]';
const MAX_PRINT_ATTEMPTS = 3;

// ─── PRINT LOCK (QUEUE SYSTEM) ───────────────────────────────────────────────
let _printLock = false;
const _queue = [];
function log(message, payload) {
  if (payload !== undefined) console.log(LOG_PREFIX, message, payload);
  else console.log(LOG_PREFIX, message);
}
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

function runPowerShell(script, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, maxBuffer: 1024 * 1024, ...options },
      (err, stdout, stderr) => {
        if (err) {
          err.stdout = stdout;
          err.stderr = stderr;
          return reject(err);
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

function normalizePrinterName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPrinterUsable(printer) {
  if (!printer) return false;
  const status = String(printer.status || '').toLowerCase();
  const statusDescription = String(printer.statusDescription || '').toLowerCase();
  if (printer.workOffline) return false;
  if (['offline', 'error', 'unknown'].includes(status)) return false;
  if (statusDescription.includes('offline') || statusDescription.includes('error')) return false;
  return true;
}

function parseJsonArray(stdout) {
  const trimmed = String(stdout || '').trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  return Array.isArray(parsed) ? parsed : [parsed];
}

// ─── PRINTER LIST ────────────────────────────────────────────────────────────
// Uses Get-Printer as the source of installed Windows printers. Win32_Printer is
// only joined to enrich the records with the Windows default-printer flag because
// Get-Printer output differs slightly between Windows 10 and Windows 11 builds.
async function listPrinters() {
  if (process.platform !== 'win32') {
    log('Printer detection skipped because this operating system is not Windows.');
    return [];
  }

  const script = `
    $ErrorActionPreference = 'Stop'
    $installed = @(Get-Printer | Select-Object Name, PrinterStatus, WorkOffline, Type, PortName, Shared, ShareName)
    $win32 = @(Get-CimInstance Win32_Printer | Select-Object Name, Default, WorkOffline, PrinterStatus)
    $printers = foreach ($printer in $installed) {
      $match = $win32 | Where-Object { $_.Name -ieq $printer.Name } | Select-Object -First 1
      [PSCustomObject]@{
        name = [string]$printer.Name
        status = [string]$printer.PrinterStatus
        statusDescription = if ($match) { [string]$match.PrinterStatus } else { [string]$printer.PrinterStatus }
        workOffline = [bool](if ($printer.WorkOffline -ne $null) { $printer.WorkOffline } elseif ($match) { $match.WorkOffline } else { $false })
        isDefault = [bool](if ($match) { $match.Default } else { $false })
        type = [string]$printer.Type
        portName = [string]$printer.PortName
        shared = [bool]$printer.Shared
        shareName = [string]$printer.ShareName
      }
    }
    $printers | ConvertTo-Json -Depth 4
  `;

  try {
    const { stdout } = await runPowerShell(script);
    const printers = parseJsonArray(stdout).map((printer) => ({
      ...printer,
      usable: isPrinterUsable(printer),
    }));
    log('Available printers detected:', printers.map((p) => ({ name: p.name, isDefault: p.isDefault, usable: p.usable, status: p.status, offline: p.workOffline })));
    return printers;
  } catch (err) {
    log('Windows returned an error while detecting printers:', { message: err.message, stderr: err.stderr });
    return [];
  }
}

function matchSavedPrinter(savedName, printers) {
  if (!savedName) return null;
  const exact = printers.find((printer) => printer.name.toLowerCase() === savedName.toLowerCase());
  if (exact) return exact;

  // Renamed printers often keep the original words plus a suffix such as "Copy 1".
  // This normalized partial match keeps the app working after minor Windows renames
  // while still avoiding hardcoded paths, IP addresses, or share names.
  const savedNormalized = normalizePrinterName(savedName);
  if (!savedNormalized) return null;
  return printers.find((printer) => {
    const currentNormalized = normalizePrinterName(printer.name);
    return currentNormalized.includes(savedNormalized) || savedNormalized.includes(currentNormalized);
  }) || null;
}

async function detectPrinter(preferredPrinterName = null) {
  const printers = await listPrinters();
 const savedPrinterName = preferredPrinterName || printerSettings.getSelectedPrinterName();
  const warnings = [];

  if (!printers.length) {
    warnings.push('No Windows printers are installed. Install a printer or check Windows printer settings.');
    log('No printers installed.');
    return { printer: null, printers, selectedPrinterName: savedPrinterName, source: 'none', warnings };
  }

  const savedMatch = matchSavedPrinter(savedPrinterName, printers);
  if (savedPrinterName && savedMatch && isPrinterUsable(savedMatch)) {
    log('Selected saved printer:', savedMatch.name);
    return { printer: savedMatch, printers, selectedPrinterName: savedPrinterName, source: 'saved', warnings };
  }

  if (savedPrinterName) {
    warnings.push(`Saved printer "${savedPrinterName}" is unavailable. Falling back automatically.`);
    log('Saved printer unavailable; falling back.', { savedPrinterName });
  }


const defaultPrinter = printers.find((printer) => printer.isDefault && isPrinterUsable(printer));
  if (defaultPrinter) {
    log('Selected Windows default printer:', defaultPrinter.name);
    return { printer: defaultPrinter, printers, selectedPrinterName: savedPrinterName, source: 'default', warnings };
  }

 const firstUsablePrinter = printers.find(isPrinterUsable);
  if (firstUsablePrinter) {
    warnings.push('Windows default printer is unavailable. Using the first available printer.');
    log('Selected first available printer:', firstUsablePrinter.name);
    return { printer: firstUsablePrinter, printers, selectedPrinterName: savedPrinterName, source: 'first', warnings };
  }

  warnings.push('Printers were detected, but all appear offline, unavailable, or in an error state.');
  log('Printers detected but none are usable:', printers);
  return { printer: null, printers, selectedPrinterName: savedPrinterName, source: 'none', warnings };
}

function classifyPrintError(error) {
  const text = `${error?.message || ''} ${error?.stderr || ''} ${error?.stdout || ''}`.toLowerCase();
  if (text.includes('access is denied') || text.includes('access denied')) return 'Access denied while printing. Run the app with proper printer permissions or check Windows sharing/security settings.';
  if (text.includes('offline')) return 'Printer is offline.';
  if (text.includes('not found') || text.includes('invalid printer name')) return 'Selected printer is no longer installed or its name changed.';
  if (text.includes('network') || text.includes('unavailable')) return 'Shared printer or network printer is unavailable.';
  return error?.message || 'Printer not responding.';
}

// ─── RAW PRINT (ESC/POS) ─────────────────────────────────────────────────────
function printRaw(printerName, text) {
  return new Promise((resolve, reject) => {
const tempFile = path.join(os.tmpdir(), `receipt_${process.pid}_${Date.now()}.bin`);
    const psFile = path.join(os.tmpdir(), `receipt_print_${process.pid}_${Date.now()}.ps1`);

    const ESC = '\x1B';
    const GS  = '\x1D';
 // ESC/POS command sequence is intentionally unchanged: initialize, center,
    // receipt content, feed, and cut. Only the delivery mechanism changed from a
    // hardcoded UNC copy path to Windows spooler RAW printing by detected name.
    const data =
      ESC + '@' +
      ESC + 'a' + '\x01' +
      text +
      '\n\n\n\n' +
      GS + 'V' + '\x41' + '\x10';

    fs.writeFileSync(tempFile, data, 'binary');
 const psScript = `
param([string]$PrinterName, [string]$DataFile)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool OpenPrinter(string szPrinterName, out IntPtr phPrinter, IntPtr pDefault);
  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
}
'@
$printer = Get-Printer -Name $PrinterName -ErrorAction Stop
if ($printer.WorkOffline) { throw "Printer '$PrinterName' is offline." }
$bytes = [System.IO.File]::ReadAllBytes($DataFile)
$handle = [IntPtr]::Zero
if (-not [RawPrinterHelper]::OpenPrinter($PrinterName, [ref]$handle, [IntPtr]::Zero)) { throw "OpenPrinter failed with Windows error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())." }
try {
  $docInfo = New-Object RawPrinterHelper+DOCINFOA
  $docInfo.pDocName = 'CafePOS Receipt'
  $docInfo.pDataType = 'RAW'
  if (-not [RawPrinterHelper]::StartDocPrinter($handle, 1, $docInfo)) { throw "StartDocPrinter failed with Windows error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())." }
  if (-not [RawPrinterHelper]::StartPagePrinter($handle)) { throw "StartPagePrinter failed with Windows error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())." }
  $written = 0
  if (-not [RawPrinterHelper]::WritePrinter($handle, $bytes, $bytes.Length, [ref]$written)) { throw "WritePrinter failed with Windows error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())." }
  if ($written -ne $bytes.Length) { throw "WritePrinter wrote $written of $($bytes.Length) bytes." }
  [void][RawPrinterHelper]::EndPagePrinter($handle)
  [void][RawPrinterHelper]::EndDocPrinter($handle)
  Write-Output "RAW print job sent to $PrinterName ($written bytes)."
} finally {
  if ($handle -ne [IntPtr]::Zero) { [void][RawPrinterHelper]::ClosePrinter($handle) }
}
`;


 fs.writeFileSync(psFile, psScript, 'utf8');

    let attempts = 0;

    const cleanup = () => {
      try { fs.unlinkSync(tempFile); } catch {}
      try { fs.unlinkSync(psFile); } catch {}
    };

    let attempts = 0;

    const tryPrint = () => {
   attempts += 1;
      log(`Sending print job attempt ${attempts}/${MAX_PRINT_ATTEMPTS}.`, { printerName });

      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile, '-PrinterName', printerName, '-DataFile', tempFile],
        { windowsHide: true, maxBuffer: 1024 * 1024 },
        (err, stdout, stderr) => {
          if (!err) {
            cleanup();
            log('Print job status:', stdout.trim() || 'RAW print job completed.');
            return setTimeout(() => resolve(true), 1200);
          }

          log('Windows print error:', { message: err.message, stdout, stderr });
          if (attempts < MAX_PRINT_ATTEMPTS) return setTimeout(tryPrint, 1500);


          cleanup();
          const friendly = classifyPrintError({ ...err, stdout, stderr });
          reject(new Error(friendly));
        }
      )

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
  const GS = '\x1D';

  const padRight = (value, len) => value.toString().padEnd(len, ' ');
  const padLeft = (value, len) => value.toString().padStart(len, ' ');
  const money = (value) => parseFloat(value || 0).toFixed(0);

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
  ].filter(Boolean);

  const itemLines = items.map((item) => (
    padRight(item.product_name.substring(0, 16), 16) +
    padLeft(item.quantity, 4) +
    padLeft(money(item.price), 6) +
    padLeft(money(item.subtotal), 6)
  ));


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
async function printReceipt(data, preferredPrinterName = null) {
  await acquireLock();

  try {
    const printer = await detectPrinter(PRINTER_NAME);
    const text = formatReceipt(data);

    if (!detection.printer) {
      log('Receipt was not printed because no usable printer was detected.');
      return {
        success: false,
        message: detection.warnings.join(' ') || 'No usable printer found.',
        warnings: detection.warnings,
        printers: detection.printers,
      };
    }

 await printRaw(detection.printer.name, text);
    await new Promise((resolve) => setTimeout(resolve, 800));
    await printRaw(detection.printer.name, text);

  return {
      success: true,
      printerName: detection.printer.name,
      source: detection.source,
      warnings: detection.warnings,
    };
  } catch (err) {
        log('Print receipt failed:', err.message);
    return { success: false, message: err.message };
  } finally {
    releaseLock();
  }
}
async function getPrinterSettings() {
  const detection = await detectPrinter();
  return {
    success: true,
    printers: detection.printers,
    selectedPrinterName: printerSettings.getSelectedPrinterName(),
    activePrinterName: detection.printer?.name || '',
    source: detection.source,
    warnings: detection.warnings,
  };
}

function savePrinterSettings(printerName) {
  log('Saving selected printer:', printerName || '(automatic)');
  return printerSettings.saveSelectedPrinterName(printerName);
}

async function testPrint() {
  return printReceipt({
    cafe: { name: 'CafePOS' },
    invoice: 'TEST-PRINT',
    items: [{ product_name: 'Printer Test', quantity: 1, price: 0, subtotal: 0 }],
    subtotal: 0,
    total: 0,
    paymentMethod: 'test',
    date: new Date().toLocaleString(),
  });
}

module.exports = {
  printReceipt,
    printRaw,
  detectPrinter,
  listPrinters,
  getPrinterSettings,
  savePrinterSettings,
  testPrint,
  listUSBDevices: listPrinters,
};