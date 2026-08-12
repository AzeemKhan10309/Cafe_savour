const ORDER_LOCALE = 'en-PK';

function parseOrderDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const timestamp = String(value).trim();

  // SQLite CURRENT_TIMESTAMP stores UTC as "YYYY-MM-DD HH:mm:ss" without a
  // timezone marker. Treat that shape as UTC so it renders to the same local
  // order time used when the receipt/stories timestamp is created.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
    return new Date(`${timestamp.replace(' ', 'T')}Z`);
  }

  return new Date(timestamp);
}

export function formatOrderDateTime(value) {
  const date = parseOrderDate(value);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString(ORDER_LOCALE) : '—';
}

export function formatOrderTime(value) {
  const date = parseOrderDate(value);
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleTimeString(ORDER_LOCALE, { hour: '2-digit', minute: '2-digit' })
    : '—';
}

export function todayOrderKey() {
  return new Date().toLocaleDateString('en-CA');
}