const db = require('../database/db');

const SELECTED_PRINTER_KEY = 'selected_printer_name';

function getSelectedPrinterName() {
  return db.getSetting(SELECTED_PRINTER_KEY) || '';
}

function saveSelectedPrinterName(printerName) {
  const cleanName = String(printerName || '').trim();
  db.setSetting(SELECTED_PRINTER_KEY, cleanName);
  return { success: true, selectedPrinterName: cleanName };
}

function clearSelectedPrinterName() {
  db.setSetting(SELECTED_PRINTER_KEY, '');
  return { success: true, selectedPrinterName: '' };
}

module.exports = {
  SELECTED_PRINTER_KEY,
  getSelectedPrinterName,
  saveSelectedPrinterName,
  clearSelectedPrinterName,
};