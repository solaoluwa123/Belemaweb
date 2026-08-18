export * from './formatters';
export * from './security';
export {
  isValidEmail,
  isValidPhoneNumber,
  isValidAmount,
  isValidAccountNumber,
  detectSuspiciousPatterns,
  maskAccountNumber,
  maskCardNumber,
  maskEmail,
} from './security';

export const validators = {
  required: (value) => !!value || 'This field is required',
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Invalid email address',
  minLength: (min) => (value) => value.length >= min || `Minimum ${min} characters required`,
  maxLength: (max) => (value) => value.length <= max || `Maximum ${max} characters allowed`,
  numeric: (value) => /^\d+$/.test(value) || 'Only numbers allowed',
  alphanumeric: (value) => /^[a-zA-Z0-9]+$/.test(value) || 'Only letters and numbers allowed',
};
