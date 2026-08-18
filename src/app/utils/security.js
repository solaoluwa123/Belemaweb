import { getApiOrigin } from "../config/runtimeConfig";
import { readLocalStorage, removeLocalStorage, setLocalStorage, STORAGE_KEY_NAMES } from "../config/storage";

export function sanitizeInput(input) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return input.replace(/[&<>"'/]/g, (char) => map[char]);
}

export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhoneNumber(phone) {
  const phoneRegex = /^(\+234|0)[789][01]\d{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export function maskAccountNumber(accountNumber) {
  if (accountNumber.length <= 4) return accountNumber;
  return accountNumber.slice(0, 2) + '****' + accountNumber.slice(-2);
}

export function maskCardNumber(cardNumber) {
  const cleaned = cardNumber.replace(/\s/g, '');
  if (cleaned.length !== 16) return cardNumber;
  return cleaned.slice(0, 4) + ' **** **** ' + cleaned.slice(-4);
}

export function maskEmail(email) {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return name.charAt(0) + '****' + name.charAt(name.length - 1) + '@' + domain;
}

export function generateSecureToken(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

class RateLimiter {
  constructor() {
    this.attempts = new Map();
  }

  loadAttempts() {
    try {
      const raw = readLocalStorage(STORAGE_KEY_NAMES.RATE_LIMITER_ATTEMPTS);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  saveAttempts(allAttempts) {
    try {
      setLocalStorage(STORAGE_KEY_NAMES.RATE_LIMITER_ATTEMPTS, JSON.stringify(allAttempts));
    } catch {
      return;
    }
  }

  isRateLimited(key, maxAttempts = 5, windowMs = 60000) {
    const now = Date.now();
    const persisted = this.loadAttempts();
    const attempts = persisted[key] || this.attempts.get(key) || [];
    const recentAttempts = attempts.filter((time) => now - time < windowMs);
    if (recentAttempts.length >= maxAttempts) {
      this.attempts.set(key, recentAttempts);
      persisted[key] = recentAttempts;
      this.saveAttempts(persisted);
      return true;
    }
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    persisted[key] = recentAttempts;
    this.saveAttempts(persisted);
    return false;
  }

  reset(key) {
    this.attempts.delete(key);
    const persisted = this.loadAttempts();
    delete persisted[key];
    this.saveAttempts(persisted);
  }
}

export const rateLimiter = new RateLimiter();

export class SessionManager {
  constructor() {
    this.timeoutId = null;
    this.lastActivity = Date.now();
    this.TIMEOUT_DURATION = 30 * 60 * 1000;
    this.events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    this.activityHandler = null;
    this.onTimeout = null;
  }

  start(onTimeout) {
    this.onTimeout = onTimeout;
    this.activityHandler = () => this.updateActivity();
    this.events.forEach((event) => {
      document.addEventListener(event, this.activityHandler, { passive: true });
    });
    this.resetTimer();
  }

  updateActivity() {
    this.lastActivity = Date.now();
    this.resetTimer();
  }

  resetTimer() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (!this.onTimeout) return;
    this.timeoutId = setTimeout(() => this.onTimeout?.(), this.TIMEOUT_DURATION);
  }

  stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.activityHandler) {
      this.events.forEach((event) => {
        document.removeEventListener(event, this.activityHandler);
      });
      this.activityHandler = null;
    }
    this.onTimeout = null;
  }

  getTimeUntilTimeout() {
    const elapsed = Date.now() - this.lastActivity;
    const remaining = Math.max(0, this.TIMEOUT_DURATION - elapsed);
    return Math.floor(remaining / 1000);
  }
}

export const sessionManager = new SessionManager();

export const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'", ...(getApiOrigin() ? [getApiOrigin()] : [])],
  fontSrc: ["'self'", 'data:'],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
};

export function isValidAmount(amount) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(num) && num > 0 && num < Number.MAX_SAFE_INTEGER;
}

export function isValidAccountNumber(accountNumber) {
  const cleaned = accountNumber.replace(/\s/g, '');
  return /^\d{10}$/.test(cleaned);
}

export function detectSuspiciousPatterns(input) {
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|EXECUTE)\b)/gi;
  const scriptPatterns = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  const xssPatterns = /(javascript:|onerror=|onclick=|onload=)/gi;
  return sqlPatterns.test(input) || scriptPatterns.test(input) || xssPatterns.test(input);
}

export const secureStorage = {
  setItem(key, value) {
    try {
      setLocalStorage(key, btoa(value));
    } catch (error) {
      console.error('Failed to store data securely:', error);
    }
  },
  getItem(key) {
    try {
      const encoded = readLocalStorage(key);
      return encoded ? atob(encoded) : null;
    } catch (error) {
      console.error('Failed to retrieve data securely:', error);
      return null;
    }
  },
  removeItem(key) {
    removeLocalStorage(key);
  },
  clear() {
    Object.values(STORAGE_KEY_NAMES).forEach((keyName) => removeLocalStorage(keyName));
  },
};
