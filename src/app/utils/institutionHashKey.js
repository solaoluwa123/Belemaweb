const HASH_KEY_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const HASH_KEY_PATTERN = /^[A-Za-z0-9]{32}$/;

export function generateInstitutionHashKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => HASH_KEY_CHARS[b % HASH_KEY_CHARS.length]).join("");
}

export function sanitizeInstitutionHashKeyInput(value) {
  return String(value || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
}

export function isValidInstitutionHashKey(value) {
  return HASH_KEY_PATTERN.test(String(value || "").trim());
}
