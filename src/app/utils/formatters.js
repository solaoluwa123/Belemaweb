export function formatCurrency(amount, currency = 'NGN', locale = 'en-NG') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCompactNumber(num) {
  return new Intl.NumberFormat('en', { notation: 'compact', compactDisplay: 'short' }).format(num);
}

/** Default placeholder for dates we cannot parse. Keep in sync with shared helpers below. */
export const INVALID_DATE_FALLBACK = 'empty';

const EMPTY_CELL = 'empty';

/** True when a table cell has no real value (including the leaked string "undefined"). */
export function isBlankDisplayValue(value) {
  if (value == null) return true;
  if (typeof value === 'number') return !Number.isFinite(value);
  if (typeof value === 'boolean') return false;
  const text = String(value).trim();
  return !text || text === 'undefined' || text === 'null' || text === 'NaN' || text === 'Invalid Date';
}

/** Show the real value, or `empty` when there is nothing to display. */
export function formatEmptyCell(value) {
  if (isBlankDisplayValue(value)) return EMPTY_CELL;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

/** Local calendar date as YYYY-MM-DD. */
export function formatLocalYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Join non-blank parts, or `empty`. */
export function formatJoinedCell(parts, separator = ' — ') {
  const kept = (parts || [])
    .filter((p) => !isBlankDisplayValue(p))
    .map((p) => String(p).trim());
  return kept.length ? kept.join(separator) : EMPTY_CELL;
}

/**
 * Parse anything the backend might emit for a date column into a real `Date`.
 *
 * Handles:
 *   - `null` / `undefined` / empty / whitespace            → null
 *   - The literal strings `"undefined"` / `"null"`         → null  (leaks from String(undefined))
 *   - `"0000-00-00"` / `"0000-00-00 00:00:00"` zero dates  → null  (MySQL "no value" sentinel)
 *   - MySQL DATETIME `"YYYY-MM-DD HH:MM:SS[.fff]"`         → Date (Safari rejects raw form)
 *   - `"YYYY-MM-DD"` date-only                             → Date
 *   - ISO 8601 with/without `Z`/offset                     → Date
 *   - Epoch seconds / milliseconds (number or numeric str) → Date
 *   - Existing `Date` instances                            → Date (when valid) or null
 *
 * Never returns a `Date` whose `getTime()` is `NaN`, so callers can safely chain
 * `.toLocaleString()` etc. without producing the literal text "Invalid Date".
 */
export function parseBackendDate(value) {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const ms = Math.abs(value) < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const text = String(value).trim();
  if (!text) return null;
  if (text === 'undefined' || text === 'null' || text === 'NaN') return null;
  if (/^0{4}-0{2}-0{2}([ T]0{2}:0{2}:0{2}(\.0+)?)?$/.test(text)) return null;

  if (/^-?\d+$/.test(text)) {
    const n = Number(text);
    if (!Number.isFinite(n)) return null;
    const ms = Math.abs(n) < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // MySQL DATETIME → ISO (treat as local time; do NOT append Z).
  const looksLikeMysqlDatetime = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(text);
  const candidate = looksLikeMysqlDatetime ? text.replace(' ', 'T') : text;
  const d = new Date(candidate);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Epoch-ms suitable for sort/filter comparisons. Returns `0` (not `NaN`) when the value
 * is unparseable so list sorts stay stable instead of jumbling rows.
 */
export function getBackendDateTime(value) {
  const d = parseBackendDate(value);
  return d ? d.getTime() : 0;
}

/** Localized date (no time). Returns `fallback` when value is unparseable. */
export function formatBackendDate(value, options = {}) {
  const { fallback = INVALID_DATE_FALLBACK, locale, ...intlOptions } = options;
  const d = parseBackendDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString(locale, intlOptions);
}

/** Localized date + time. Returns `fallback` when value is unparseable. */
export function formatBackendDateTime(value, options = {}) {
  const { fallback = INVALID_DATE_FALLBACK, locale, ...intlOptions } = options;
  const d = parseBackendDate(value);
  if (!d) return fallback;
  return d.toLocaleString(locale, intlOptions);
}

/** Localized time only. Returns `fallback` when value is unparseable. */
export function formatBackendTime(value, options = {}) {
  const { fallback = INVALID_DATE_FALLBACK, locale, ...intlOptions } = options;
  const d = parseBackendDate(value);
  if (!d) return fallback;
  return d.toLocaleTimeString(locale, intlOptions);
}

export function formatDateTime(date, format = 'long') {
  const d = parseBackendDate(date);
  if (!d) return INVALID_DATE_FALLBACK;
  if (format === 'relative') return formatRelativeTime(d);
  const options =
    format === 'long'
      ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { year: 'numeric', month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat('en-US', options).format(d);
}

export function formatRelativeTime(date) {
  const d = parseBackendDate(date);
  if (!d) return INVALID_DATE_FALLBACK;
  const diffInSeconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
}

export function formatAccountNumber(accountNumber) {
  return accountNumber.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatCardNumber(cardNumber) {
  const cleaned = cardNumber.replace(/\s/g, '');
  return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function formatPercentage(value, decimals = 2) {
  return `${value.toFixed(decimals)}%`;
}

export function formatPhoneNumber(phone) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('234')) {
    return `+234 ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  }
  if (cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

export function formatTransactionRef(ref) {
  return ref.replace(/(.{4})/g, '$1-').slice(0, -1);
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function toTitleCase(str) {
  return str.replace(/[_-]/g, ' ').split(' ').map(capitalize).join(' ');
}

export function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function parseCurrency(currencyString) {
  return parseFloat(currencyString.replace(/[^0-9.-]+/g, ''));
}

export function formatBVN(bvn) {
  const cleaned = bvn.replace(/\D/g, '');
  return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatNIN(nin) {
  const cleaned = nin.replace(/\D/g, '');
  return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function getStatusColor(status) {
  const statusLower = status.toLowerCase();
  const colorMap = {
    success: 'text-green-600 bg-green-50',
    completed: 'text-green-600 bg-green-50',
    approved: 'text-green-600 bg-green-50',
    active: 'text-green-600 bg-green-50',
    pending: 'text-yellow-600 bg-yellow-50',
    processing: 'text-yellow-600 bg-yellow-50',
    'in-progress': 'text-yellow-600 bg-yellow-50',
    failed: 'text-red-600 bg-red-50',
    rejected: 'text-red-600 bg-red-50',
    declined: 'text-red-600 bg-red-50',
    error: 'text-red-600 bg-red-50',
    inactive: 'text-gray-600 bg-gray-50',
    cancelled: 'text-gray-600 bg-gray-50',
    suspended: 'text-gray-600 bg-gray-50',
  };
  return colorMap[statusLower] || 'text-gray-600 bg-gray-50';
}
