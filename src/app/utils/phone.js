/**
 * Nigerian phone helpers: UI stores 10 local digits; DB gets +234XXXXXXXXXX (14 chars).
 */

/** Digits only; strip leading 234 or 0; keep up to 10 local digits. */
export function toLocalPhoneDigits(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("234")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/** Empty → ""; else "+234" + local digits (max 10). */
export function toStoredPhoneNumber(localDigits) {
  const local = String(localDigits || "").replace(/\D/g, "").slice(0, 10);
  if (!local) return "";
  return `+234${local}`;
}

/** Empty OK (optional); otherwise exactly 10 digits. */
export function isValidNgPhoneLocal(localDigits) {
  const local = String(localDigits || "").replace(/\D/g, "");
  if (!local) return true;
  return /^\d{10}$/.test(local);
}

/** Accept raw or local; normalize to stored +234 form. */
export function normalizeToStoredPhone(value) {
  return toStoredPhoneNumber(toLocalPhoneDigits(value));
}
