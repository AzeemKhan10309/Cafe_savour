const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const printerSettings = require('./printerSettingsService');
const { BUSINESS_INFO } = require('../../shared/businessInfo');

const LOG_PREFIX = '[PrinterService]';
const MAX_PRINT_ATTEMPTS = 3;

const ESC = '\x1B';
const GS = '\x1D';

// ─── PRINT LOCK (QUEUE SYSTEM) ───────────────────────────────────────────────
let _printLock = false;
const _queue = [];

function log(message, payload) {
  if (payload !== undefined) {
    console.log(LOG_PREFIX, message, payload);
  } else {
    console.log(LOG_PREFIX, message);
  }
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
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script
      ],
      {
        windowsHide: true,
        maxBuffer: 1024 * 1024,
        ...options
      },
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
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isPrinterUsable(printer) {
  if (!printer) return false;

  const status = String(printer.status || '').toLowerCase();
  const statusDescription = String(
    printer.statusDescription || ''
  ).toLowerCase();

  if (printer.workOffline) return false;

  if (['offline', 'error'].includes(status)) {
    return false;
  }

  if (
    statusDescription.includes('offline') ||
    statusDescription.includes('error')
  ) {
    return false;
  }

  return true;
}

function parseJsonArray(stdout) {
  const trimmed = String(stdout || '').trim();

  if (!trimmed) return [];

  const parsed = JSON.parse(trimmed);

  return Array.isArray(parsed) ? parsed : [parsed];
}

// ─── PRINTER LIST ────────────────────────────────────────────────────────────

async function listPrinters() {
  if (process.platform !== 'win32') {
    log(
      'Printer detection skipped because this operating system is not Windows.'
    );

    return [];
  }

  const script = `
    $ErrorActionPreference = 'Stop'

    function Convert-PrinterStatusName([object]$value) {
      if ($null -eq $value) {
        return ''
      }

      $text = [string]$value

      switch ($text) {
        '0' { return 'Ready' }
        '1' { return 'Other' }
        '2' { return 'Unknown' }
        '3' { return 'Ready' }
        '4' { return 'Printing' }
        '5' { return 'Warmup' }
        default { return $text }
      }
    }

    $installed = @()

    try {
      $installed = @(
        Get-Printer -ErrorAction Stop |
        Select-Object Name, PrinterStatus, WorkOffline, Type, PortName, Shared, ShareName
      )
    } catch {
      $installed = @()
    }

    $win32 = @()

    try {
      $win32 = @(
        Get-CimInstance Win32_Printer -ErrorAction Stop |
        Select-Object Name, Default, WorkOffline, PrinterStatus, PortName, Shared, ShareName, Network
      )
    } catch {
      try {
        $win32 = @(
          Get-WmiObject Win32_Printer -ErrorAction Stop |
          Select-Object Name, Default, WorkOffline, PrinterStatus, PortName, Shared, ShareName, Network
        )
      } catch {
        $win32 = @()
      }
    }

    $names = @(
      @($installed | ForEach-Object { $_.Name }) +
      @($win32 | ForEach-Object { $_.Name })
    ) |
    Where-Object { $_ } |
    Sort-Object -Unique

    $printers = foreach ($name in $names) {

      $printer = $installed |
        Where-Object { $_.Name -ieq $name } |
        Select-Object -First 1

      $match = $win32 |
        Where-Object { $_.Name -ieq $name } |
        Select-Object -First 1

      # --- status ---
      $rawStatus = $null

      if ($printer) {
        $rawStatus = $printer.PrinterStatus
      }
      elseif ($match) {
        $rawStatus = $match.PrinterStatus
      }

      $status = Convert-PrinterStatusName $rawStatus

      $statusDescription = $status

      if ($match) {
        $statusDescription =
          Convert-PrinterStatusName $match.PrinterStatus
      }

      # --- work offline ---
      $workOffline = $false

      if ($printer -and $null -ne $printer.WorkOffline) {
        $workOffline = [bool]$printer.WorkOffline
      }
      elseif ($match -and $null -ne $match.WorkOffline) {
        $workOffline = [bool]$match.WorkOffline
      }

      # --- default ---
      $isDefault = $false

      if ($match -and $match.Default) {
        $isDefault = $true
      }

      # --- type ---
      $type = ''

      if ($printer -and $printer.Type) {
        $type = [string]$printer.Type
      }
      elseif ($match -and $match.Network) {
        $type = 'Network'
      }

      # --- port ---
      $portName = ''

      if ($printer) {
        $portName = [string]$printer.PortName
      }
      elseif ($match) {
        $portName = [string]$match.PortName
      }

      # --- shared ---
      $shared = $false

      if ($printer -and $printer.Shared) {
        $shared = $true
      }
      elseif ($match -and $match.Shared) {
        $shared = $true
      }

      # --- share name ---
      $shareName = ''

      if ($printer) {
        $shareName = [string]$printer.ShareName
      }
      elseif ($match) {
        $shareName = [string]$match.ShareName
      }

      [PSCustomObject]@{
        name              = [string]$name
        status            = [string]$status
        statusDescription = [string]$statusDescription
        workOffline       = [bool]$workOffline
        isDefault         = [bool]$isDefault
        type              = [string]$type
        portName          = [string]$portName
        shared            = [bool]$shared
        shareName         = [string]$shareName
      }
    }

    if ($printers) {
      @($printers) | ConvertTo-Json -Depth 4
    }
    else {
      '[]'
    }
  `;

  try {
    const { stdout } = await runPowerShell(script);

    const printers = parseJsonArray(stdout)
      .filter((printer) => printer?.name)
      .map((printer) => ({
        ...printer,
        usable: isPrinterUsable(printer)
      }));

    log(
      'Available printers detected:',
      printers.map((p) => ({
        name: p.name,
        isDefault: p.isDefault,
        usable: p.usable,
        status: p.status,
        offline: p.workOffline
      }))
    );

    return printers;
  } catch (err) {
    log(
      'Windows returned an error while detecting printers:',
      {
        message: err.message,
        stderr: err.stderr,
        stdout: err.stdout
      }
    );

    return [];
  }
}

function matchSavedPrinter(savedName, printers) {
  if (!savedName) return null;

  const exact = printers.find(
    (printer) =>
      printer.name.toLowerCase() === savedName.toLowerCase()
  );

  if (exact) return exact;

  const savedNormalized = normalizePrinterName(savedName);

  if (!savedNormalized) return null;

  return (
    printers.find((printer) => {
      const currentNormalized =
        normalizePrinterName(printer.name);

      return (
        currentNormalized.includes(savedNormalized) ||
        savedNormalized.includes(currentNormalized)
      );
    }) || null
  );
}

async function detectPrinter(preferredPrinterName = null) {
  const printers = await listPrinters();

  const savedPrinterName =
    preferredPrinterName ||
    printerSettings.getSelectedPrinterName();

  const warnings = [];

  if (!printers.length) {
    warnings.push(
      'No Windows printers were detected. Install a printer, enable the Windows Print Spooler, or check Windows printer settings.'
    );

    log('No printers installed.');

    return {
      printer: null,
      printers,
      selectedPrinterName: savedPrinterName,
      source: 'none',
      warnings
    };
  }

  const savedMatch =
    matchSavedPrinter(savedPrinterName, printers);

  if (
    savedPrinterName &&
    savedMatch &&
    isPrinterUsable(savedMatch)
  ) {
    log('Selected saved printer:', savedMatch.name);

    return {
      printer: savedMatch,
      printers,
      selectedPrinterName: savedPrinterName,
      source: 'saved',
      warnings
    };
  }

  if (savedPrinterName) {
    warnings.push(
      `Saved printer "${savedPrinterName}" is unavailable. Falling back automatically.`
    );

    log(
      'Saved printer unavailable; falling back.',
      { savedPrinterName }
    );
  }

  const defaultPrinter = printers.find(
    (printer) =>
      printer.isDefault &&
      isPrinterUsable(printer)
  );

  if (defaultPrinter) {
    log(
      'Selected Windows default printer:',
      defaultPrinter.name
    );

    return {
      printer: defaultPrinter,
      printers,
      selectedPrinterName: savedPrinterName,
      source: 'default',
      warnings
    };
  }

  const firstUsablePrinter =
    printers.find(isPrinterUsable);

  if (firstUsablePrinter) {
    warnings.push(
      'Windows default printer is unavailable. Using the first available printer.'
    );

    log(
      'Selected first available printer:',
      firstUsablePrinter.name
    );

    return {
      printer: firstUsablePrinter,
      printers,
      selectedPrinterName: savedPrinterName,
      source: 'first',
      warnings
    };
  }

  warnings.push(
    'Printers were detected, but all appear offline, unavailable, or in an error state.'
  );

  log(
    'Printers detected but none are usable:',
    printers
  );

  return {
    printer: null,
    printers,
    selectedPrinterName: savedPrinterName,
    source: 'none',
    warnings
  };
}

function classifyPrintError(error) {
  const text =
    `${error?.message || ''} ` +
    `${error?.stderr || ''} ` +
    `${error?.stdout || ''}`.toLowerCase();

  if (
    text.includes('access is denied') ||
    text.includes('access denied')
  ) {
    return 'Access denied while printing. Run the app with proper printer permissions or check Windows sharing/security settings.';
  }

  if (text.includes('offline')) {
    return 'Printer is offline.';
  }

  if (
    text.includes('not found') ||
    text.includes('invalid printer name')
  ) {
    return 'Selected printer is no longer installed or its name changed.';
  }

  if (
    text.includes('network') ||
    text.includes('unavailable')
  ) {
    return 'Shared printer or network printer is unavailable.';
  }

  return (
    error?.message ||
    'Printer not responding.'
  );
}

// ─── RAW PRINT (ESC/POS) ─────────────────────────────────────────────────────

function printRaw(printerName, text) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(
      os.tmpdir(),
      `receipt_${process.pid}_${Date.now()}.bin`
    );

    const psFile = path.join(
      os.tmpdir(),
      `receipt_print_${process.pid}_${Date.now()}.ps1`
    );

    const data =
      ESC + '@' +
      ESC + 'a' + '\x01' +
      text +
      '\n\n\n\n' +
      GS + 'V' + '\x41' + '\x10';

    fs.writeFileSync(
      tempFile,
      data,
      'binary'
    );

    const psScript = `
param(
  [string]$PrinterName,
  [string]$DataFile
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    public string pDocName;
    public string pOutputFile;
    public string pDataType;
  }

  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool OpenPrinter(
    string szPrinterName,
    out IntPtr phPrinter,
    IntPtr pDefault
  );

  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool ClosePrinter(
    IntPtr hPrinter
  );

  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool StartDocPrinter(
    IntPtr hPrinter,
    int level,
    [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di
  );

  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool EndDocPrinter(
    IntPtr hPrinter
  );

  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool StartPagePrinter(
    IntPtr hPrinter
  );

  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool EndPagePrinter(
    IntPtr hPrinter
  );

  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool WritePrinter(
    IntPtr hPrinter,
    byte[] pBytes,
    int dwCount,
    out int dwWritten
  );
}
'@

$printer = $null

try {
  $printer =
    Get-Printer -Name $PrinterName -ErrorAction Stop
}
catch {
  try {
    $printer =
      Get-CimInstance Win32_Printer -ErrorAction Stop |
      Where-Object {
        $_.Name -ieq $PrinterName
      } |
      Select-Object -First 1
  }
  catch {
    $printer =
      Get-WmiObject Win32_Printer -ErrorAction Stop |
      Where-Object {
        $_.Name -ieq $PrinterName
      } |
      Select-Object -First 1
  }
}

if ($printer.WorkOffline) {
  throw "Printer '$PrinterName' is offline."
}

$bytes =
  [System.IO.File]::ReadAllBytes($DataFile)

$handle =
  [IntPtr]::Zero

if (
  -not [RawPrinterHelper]::OpenPrinter(
    $PrinterName,
    [ref]$handle,
    [IntPtr]::Zero
  )
) {
  throw "OpenPrinter failed with Windows error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())."
}

try {

  $docInfo =
    New-Object RawPrinterHelper+DOCINFOA

  $docInfo.pDocName =
    'CafePOS Receipt'

  $docInfo.pDataType =
    'RAW'

  if (
    -not [RawPrinterHelper]::StartDocPrinter(
      $handle,
      1,
      $docInfo
    )
  ) {
    throw "StartDocPrinter failed with Windows error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())."
  }

  if (
    -not [RawPrinterHelper]::StartPagePrinter(
      $handle
    )
  ) {
    throw "StartPagePrinter failed with Windows error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())."
  }

  $written = 0

  if (
    -not [RawPrinterHelper]::WritePrinter(
      $handle,
      $bytes,
      $bytes.Length,
      [ref]$written
    )
  ) {
    throw "WritePrinter failed with Windows error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())."
  }

  if ($written -ne $bytes.Length) {
    throw "WritePrinter wrote $written of $($bytes.Length) bytes."
  }

  [void][RawPrinterHelper]::EndPagePrinter($handle)
  [void][RawPrinterHelper]::EndDocPrinter($handle)

  Write-Output "RAW print job sent to $PrinterName ($written bytes)."

}
finally {

  if ($handle -ne [IntPtr]::Zero) {
    [void][RawPrinterHelper]::ClosePrinter($handle)
  }
}
`;

    fs.writeFileSync(
      psFile,
      psScript,
      'utf8'
    );

    let attempts = 0;

    const cleanup = () => {
      try {
        fs.unlinkSync(tempFile);
      } catch {}

      try {
        fs.unlinkSync(psFile);
      } catch {}
    };

    const tryPrint = () => {
      attempts += 1;

      log(
        `Sending print job attempt ${attempts}/${MAX_PRINT_ATTEMPTS}.`,
        { printerName }
      );

      execFile(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          psFile,
          '-PrinterName',
          printerName,
          '-DataFile',
          tempFile
        ],
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024
        },
        (err, stdout, stderr) => {

          if (!err) {
            cleanup();

            log(
              'Print job status:',
              stdout.trim() ||
              'RAW print job completed.'
            );

            return setTimeout(
              () => resolve(true),
              1200
            );
          }

          log(
            'Windows print error:',
            {
              message: err.message,
              stdout,
              stderr
            }
          );

          if (
            attempts < MAX_PRINT_ATTEMPTS
          ) {
            return setTimeout(
              tryPrint,
              1500
            );
          }

          cleanup();

          const friendly =
            classifyPrintError({
              ...err,
              stdout,
              stderr
            });

          return reject(
            new Error(friendly)
          );
        }
      );
    };

    tryPrint();
  });
}

// ─── RECEIPT FORMAT ──────────────────────────────────────────────────────────
//
// Layout target (matches reference receipt image):
//
//   ============================================
//                  CAFE AROMA
//              23, Green Park Road
//               Bangalore - 560001
//                Ph: 080-12345678
//   ============================================
//   Invoice: #1024
//   Date: 12-Aug-2026 18:30
//   Table: T-04
//   --------------------------------------------
//   ITEM               QTY     RATE      AMT
//   Cappuccino           2   150.00   300.00
//   Veg Sandwich         1   180.00   180.00
//   Blueberry Muffin     1   220.00   220.00
//   --------------------------------------------
//   Subtotal                           700.00
//   Discount                           -12.00
//   Service Tax 8%                      55.00
//   TOTAL                              743.00
//   --------------------------------------------
//   Order Notes: less sugar
//   --------------------------------------------
//               Thank You! Visit Again
//
// 42-column width, matching an 80mm thermal printer.

const RECEIPT_WIDTH = 42;

// Item table column widths (sum + separating spaces = RECEIPT_WIDTH)
const ITEM_COL = 18;
const QTY_COL = 5;
const RATE_COL = 8;
const AMT_COL = 8;

// Footer summary column widths
const SUMMARY_LABEL_WIDTH = 30;
const SUMMARY_AMOUNT_WIDTH = 12;

function centerText(
  value,
  width = RECEIPT_WIDTH
) {
  const text =
    String(value || '').trim();

  if (text.length >= width) {
    return text;
  }

  const left =
    Math.floor(
      (width - text.length) / 2
    );

  return (
    ' '.repeat(left) +
    text
  );
}

function padRight(value, width) {
  const text = String(value ?? '');

  if (text.length >= width) {
    return text.slice(0, width);
  }

  return text.padEnd(width, ' ');
}

function padLeft(value, width) {
  const text = String(value ?? '');

  if (text.length >= width) {
    return text.slice(-width);
  }

  return text.padStart(width, ' ');
}

function wrapReceiptLine(
  value,
  width = RECEIPT_WIDTH
) {
  const text =
    String(value || '');

  if (!text) {
    return [''];
  }

  const words =
    text
      .split(/(\s+)/)
      .filter(
        (part) => part.length
      );

  const lines = [];
  let current = '';

  words.forEach((word) => {

    if (/^\s+$/.test(word)) {

      if (
        current &&
        !current.endsWith(' ')
      ) {
        current += ' ';
      }

      return;
    }

    if (word.length > width) {

      if (current.trim()) {
        lines.push(
          current.trimEnd()
        );
      }

      for (
        let i = 0;
        i < word.length;
        i += width
      ) {

        const chunk =
          word.slice(
            i,
            i + width
          );

        if (chunk.length === width) {
          lines.push(chunk);
        } else {
          current = chunk;
        }
      }

      return;
    }

    const next =
      current
        ? `${current}${word}`
        : word;

    if (next.length > width) {

      if (current.trim()) {
        lines.push(
          current.trimEnd()
        );
      }

      current = word;

    } else {
      current = next;
    }
  });

  if (
    current.trim() ||
    !lines.length
  ) {
    lines.push(
      current.trimEnd()
    );
  }

  return lines;
}

// ─── MONEY ────────────────────────────────────────────────────────────────────

function moneyFmt(value) {
  return parseFloat(value || 0).toFixed(2);
}

// ─── ORDER NOTES ─────────────────────────────────────────────────────────────

function formatOrderNotes(notes) {

  const cleanNotes =
    String(notes || '').trim();

  if (!cleanNotes) {
    return [];
  }

  const prefix = 'Order Notes: ';

  const wrapped =
    wrapReceiptLine(
      cleanNotes,
      RECEIPT_WIDTH - prefix.length
    );

  const firstLine =
    prefix + (wrapped[0] || '');

  const restLines =
    wrapped
      .slice(1)
      .map(
        (line) =>
          ' '.repeat(prefix.length) + line
      );

  return [
    '-'.repeat(RECEIPT_WIDTH),
    firstLine,
    ...restLines
  ];
}

function getReceiptBusinessInfo(
  cafe = {}
) {
  return {
    ...BUSINESS_INFO,
    ...cafe,

    addressLines:
      cafe.addressLines?.length
        ? cafe.addressLines
        : (
            cafe.address
              ? String(cafe.address)
                  .split(',')
                  .map(
                    (line) =>
                      line.trim()
                  )
                  .filter(Boolean)
              : BUSINESS_INFO.addressLines
          )
  };
}

// ─── FORMAT RECEIPT ──────────────────────────────────────────────────────────

function formatReceipt(data) {

  const {
    cafe,
    invoice,
    items,

    // Table support
    tableName = '',
    tableNo = '',

    subtotal = 0,
    discountAmount = 0,
    discountType = 'flat',
    discount = 0,
    taxRate = 0,
    taxAmount = 0,
    serviceRate = 0,
    serviceAmount = 0,
    total,
    date,

    // Order notes
    notes = ''

  } = data;

  const business =
    getReceiptBusinessInfo(cafe);

  const line =
    '='.repeat(RECEIPT_WIDTH);

  const dashedLine =
    '-'.repeat(RECEIPT_WIDTH);

  const CENTER =
    ESC + 'a' + '\x01';

  const LEFT =
    ESC + 'a' + '\x00';

  const BOLD_ON =
    ESC + 'E' + '\x01';

  const BOLD_OFF =
    ESC + 'E' + '\x00';

  // ─── RECEIPT HEADER (centered business info) ──────────────────────────────

  const header = [

    CENTER,

    line,

    `${BOLD_ON}${business.name}${BOLD_OFF}`,

    ...business.addressLines,

    `Ph: ${business.phone}`,

    line,

    LEFT,

    `Invoice: ${invoice}`,

    `Date: ${date}`,

    // Table number
    (tableNo || tableName)
      ? `Table: ${tableNo || tableName}`
      : '',

    dashedLine

  ].filter((l) => l !== '');

  // ─── ITEMS TABLE ────────────────────────────────────────────────────────────

  const itemTableHeader =
    padRight('ITEM', ITEM_COL) + ' ' +
    padLeft('QTY', QTY_COL) + ' ' +
    padLeft('RATE', RATE_COL) + ' ' +
    padLeft('AMT', AMT_COL);

  const itemLines =
    items.flatMap((item) => {

      const nameLines =
        wrapReceiptLine(
          item.product_name,
          ITEM_COL
        );

      const firstLine =
        padRight(nameLines[0] || '', ITEM_COL) + ' ' +
        padLeft(item.quantity, QTY_COL) + ' ' +
        padLeft(moneyFmt(item.price), RATE_COL) + ' ' +
        padLeft(moneyFmt(item.subtotal), AMT_COL);

      const extraLines =
        nameLines
          .slice(1)
          .map(
            (nameLine) =>
              padRight(nameLine, ITEM_COL)
          );

      return [firstLine, ...extraLines];
    });

  // ─── SUMMARY / FOOTER ───────────────────────────────────────────────────────

  const summaryLine = (label, value) => {

    const cleanLabel =
      String(label || '').trim();

    const cleanValue =
      String(value ?? '').trim();

    return (
      padRight(cleanLabel, SUMMARY_LABEL_WIDTH) +
      padLeft(cleanValue, SUMMARY_AMOUNT_WIDTH)
    );
  };

  const discountLabel =
    discountType === 'percent'
      ? `Discount (${parseFloat(
          discount || 0
        ).toFixed(0)}%)`
      : 'Discount';

  const footer = [

    dashedLine,

    // Subtotal
    summaryLine(
      'Subtotal',
      moneyFmt(subtotal)
    ),

    // Discount
    discountAmount > 0
      ? summaryLine(
          discountLabel,
          `-${moneyFmt(discountAmount)}`
        )
      : '',

    // Service Tax
    serviceAmount > 0
      ? summaryLine(
          `Service Tax ${parseFloat(
            serviceRate || 0
          ).toFixed(0)}%`,
          moneyFmt(serviceAmount)
        )
      : '',

    // VAT Tax
    taxAmount > 0
      ? summaryLine(
          `VAT Tax ${parseFloat(
            taxRate || 0
          ).toFixed(0)}%`,
          moneyFmt(taxAmount)
        )
      : '',

    // Total
    `${BOLD_ON}${summaryLine(
      'TOTAL',
      moneyFmt(total)
    )}${BOLD_OFF}`,

    // Order Notes
    ...formatOrderNotes(notes),

    dashedLine,

    CENTER,

    `${BOLD_ON}Thank You! Visit Again${BOLD_OFF}`

  ].filter(Boolean);

  return [
    ...header,
    itemTableHeader,
    ...itemLines,
    ...footer
  ].join('\n');
}

// ─── MAIN PRINT FUNCTION ─────────────────────────────────────────────────────

async function printReceipt(
  data,
  preferredPrinterName = null
) {

  await acquireLock();

  try {

    const detection =
      await detectPrinter(
        preferredPrinterName
      );

    const text =
      formatReceipt(data);

    if (!detection.printer) {

      log(
        'Receipt was not printed because no usable printer was detected.'
      );

      return {
        success: false,
        message:
          detection.warnings.join(' ') ||
          'No usable printer found.',
        warnings:
          detection.warnings,
        printers:
          detection.printers
      };
    }

    await printRaw(
      detection.printer.name,
      text
    );

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 800)
    );

    await printRaw(
      detection.printer.name,
      text
    );

    return {
      success: true,
      printerName:
        detection.printer.name,
      source:
        detection.source,
      warnings:
        detection.warnings
    };

  } catch (err) {

    log(
      'Print receipt failed:',
      err.message
    );

    return {
      success: false,
      message: err.message
    };

  } finally {

    releaseLock();

  }
}

// ─── PRINTER SETTINGS ────────────────────────────────────────────────────────

async function getPrinterSettings() {

  const detection =
    await detectPrinter();

  return {
    success: true,
    printers:
      detection.printers,

    selectedPrinterName:
      printerSettings.getSelectedPrinterName(),

    activePrinterName:
      detection.printer?.name || '',

    source:
      detection.source,

    warnings:
      detection.warnings
  };
}

function savePrinterSettings(
  printerName
) {

  log(
    'Saving selected printer:',
    printerName || '(automatic)'
  );

  return printerSettings
    .saveSelectedPrinterName(
      printerName
    );
}

// ─── TEST PRINT ──────────────────────────────────────────────────────────────

async function testPrint() {

  return printReceipt({

    cafe: BUSINESS_INFO,

    invoice: 'TEST-PRINT',

    // Test table number
    tableNo: '05',

    items: [
      {
        product_name:
          'Printer Test',
        quantity: 1,
        price: 0,
        subtotal: 0
      }
    ],

    subtotal: 0,

    total: 0,

    date:
      new Date().toLocaleString()

  });
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {

  printReceipt,

  printRaw,

  detectPrinter,

  listPrinters,

  getPrinterSettings,

  savePrinterSettings,

  testPrint,

  formatReceipt,

  listUSBDevices: listPrinters

};
