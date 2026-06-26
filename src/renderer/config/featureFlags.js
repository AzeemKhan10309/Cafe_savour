export const FEATURE_FLAGS = {
  DASHBOARD: true,
  POS: true,
  INVENTORY: true,
  KITCHEN_INVENTORY: false,
  REPORTS: true,
  FINANCE: false,
  INVESTORS: false,
  STAFF: true,
  PRINTER_SETTINGS: true,
};

export const isFeatureEnabled = (featureKey) => FEATURE_FLAGS[featureKey] !== false;