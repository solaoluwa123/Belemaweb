import { getStorageKeys } from "../config/storage";

export const USER_ROLES = {
  ADMINISTRATOR: 1,
  OPERATOR: 2,
  APPROVER: 3,
  THIRD_PARTY_VENDOR: 4,
  FINANCIAL_INSTITUTION_USER: 5,
  MERCHANT_USER: 6,
  TERMINAL_OWNER_USER: 7,
  PTSP_USER: 8,
} as const;

export const ROLE_NAMES = {
  1: 'Administrator',
  2: 'Operator',
  3: 'Approver',
  4: 'Third Party Vendor',
  5: 'Financial Institution User',
  6: 'Merchant User',
  7: 'Terminal Owner User',
  8: 'PTSP User',
};

export const TRANSACTION_STATUS = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SUCCESS: 'Success',
  FAILED: 'Failed',
  REVERSED: 'Reversed',
  TIMEOUT: 'Timeout',
  CANCELLED: 'Cancelled',
} as const;

export const TRANSACTION_TYPE = {
  TRANSFER: 'Transfer',
  PAYMENT: 'Payment',
  WITHDRAWAL: 'Withdrawal',
  DEPOSIT: 'Deposit',
  REVERSAL: 'Reversal',
  REFUND: 'Refund',
} as const;

export const DISPUTE_STATUS = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ARBITRATED: 'Arbitrated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
} as const;

export const APPROVAL_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
} as const;

export const WALLET_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  CLOSED: 'Closed',
} as const;

export const SETTLEMENT_STATUS = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  REVERSED: 'Reversed',
} as const;

export const SETTLEMENT_TYPE = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  ON_DEMAND: 'On-Demand',
} as const;

export const RESPONSE_CODES = {
  SUCCESS: '00',
  APPROVED: '00',
  INSUFFICIENT_FUNDS: '51',
  INVALID_ACCOUNT: '57',
  TIMEOUT: '91',
  SYSTEM_ERROR: '96',
  DUPLICATE_TRANSACTION: '94',
} as const;

export const CARD_TYPE = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  VERVE: 'Verve',
  AMEX: 'American Express',
} as const;

export const PAYMENT_CHANNEL = {
  WEB: 'Web',
  MOBILE: 'Mobile',
  POS: 'POS',
  ATM: 'ATM',
  USSD: 'USSD',
  AGENCY_BANKING: 'Agency Banking',
} as const;

export const DATE_FORMATS = {
  FULL: 'MMMM d, yyyy h:mm a',
  DATE_ONLY: 'MMMM d, yyyy',
  TIME_ONLY: 'h:mm a',
  SHORT: 'MMM d, yyyy',
  ISO: 'yyyy-MM-dd',
  DATETIME: 'yyyy-MM-dd HH:mm:ss',
} as const;

export const CURRENCY = {
  NGN: 'NGN',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
} as const;

export const CURRENCY_SYMBOLS = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
  MAX_PAGE_SIZE: 100,
} as const;

export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024,
  ALLOWED_TYPES: [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/jpeg',
    'image/png',
  ],
  ALLOWED_EXTENSIONS: ['.pdf', '.xls', '.xlsx', '.csv', '.jpg', '.jpeg', '.png'],
} as const;

export const SESSION = {
  TIMEOUT_MINUTES: 30,
  WARNING_MINUTES: 5,
  IDLE_TIMEOUT: 30 * 60 * 1000,
} as const;

export const RATE_LIMIT = {
  LOGIN_ATTEMPTS: 5,
  LOGIN_WINDOW_MS: 15 * 60 * 1000,
  API_REQUESTS: 100,
  API_WINDOW_MS: 60 * 1000,
} as const;

export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 50,
  ACCOUNT_NUMBER_LENGTH: 10,
  BVN_LENGTH: 11,
  NIN_LENGTH: 11,
  PHONE_REGEX: /^(\+234|0)[789][01]\d{8}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

export const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '063', name: 'Diamond Bank' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '526', name: 'Parallex Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'SunTrust Bank' },
  { code: '302', name: 'TAJ Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
] as const;

export const CHART_COLORS = {
  PRIMARY: '#00411A',
  SUCCESS: '#CEF445',
  WARNING: '#FFD600',
  DANGER: '#E84A25',
  INFO: '#410027',
  PURPLE: '#410027',
  PINK: '#E84A25',
  TEAL: '#00411A',
} as const;

export const STATUS_COLORS = {
  success: 'bg-[#eef8c8] text-[#00411A] border-[#CEF445]',
  completed: 'bg-[#eef8c8] text-[#00411A] border-[#CEF445]',
  approved: 'bg-[#eef8c8] text-[#00411A] border-[#CEF445]',
  active: 'bg-[#eef8c8] text-[#00411A] border-[#CEF445]',
  resolved: 'bg-[#eef8c8] text-[#00411A] border-[#CEF445]',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  processing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'under-review': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'in-progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  declined: 'bg-red-100 text-red-800 border-red-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  timeout: 'bg-red-100 text-red-800 border-red-200',
  inactive: 'bg-gray-100 text-gray-800 border-gray-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  suspended: 'bg-gray-100 text-gray-800 border-gray-200',
  closed: 'bg-gray-100 text-gray-800 border-gray-200',
  expired: 'bg-gray-100 text-gray-800 border-gray-200',
  reversed: 'bg-blue-100 text-blue-800 border-blue-200',
  refunded: 'bg-blue-100 text-blue-800 border-blue-200',
  arbitrated: 'bg-purple-100 text-purple-800 border-purple-200',
} as const;

export const STORAGE_KEYS = getStorageKeys();

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  SESSION_EXPIRED: 'Your session has expired. Please login again.',
  SERVER_ERROR: 'A server error occurred. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  NOT_FOUND: 'The requested resource was not found.',
  DUPLICATE: 'This record already exists.',
  INSUFFICIENT_FUNDS: 'Insufficient funds to complete this transaction.',
  RATE_LIMIT: 'Too many requests. Please try again later.',
} as const;

export const SUCCESS_MESSAGES = {
  LOGIN: 'Login successful!',
  LOGOUT: 'Logged out successfully.',
  CREATE: 'Created successfully!',
  UPDATE: 'Updated successfully!',
  DELETE: 'Deleted successfully!',
  APPROVE: 'Approved successfully!',
  REJECT: 'Rejected successfully!',
  SUBMIT: 'Submitted successfully!',
  UPLOAD: 'File uploaded successfully!',
  SAVE: 'Changes saved successfully!',
} as const;

export const API_TIMEOUT = {
  DEFAULT: 30000,
  UPLOAD: 120000,
  DOWNLOAD: 120000,
  LONG_RUNNING: 300000,
} as const;

export const WS_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  TRANSACTION_UPDATE: 'transaction:update',
  DISPUTE_UPDATE: 'dispute:update',
  NOTIFICATION: 'notification',
  HEARTBEAT: 'heartbeat',
} as const;

export const NOTIFICATION_TYPE = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

export const EXPORT_FORMAT = {
  CSV: 'csv',
  EXCEL: 'xlsx',
  PDF: 'pdf',
} as const;

export const TIME_PERIOD = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  THIS_MONTH: 'this_month',
  LAST_MONTH: 'last_month',
  THIS_YEAR: 'this_year',
  CUSTOM: 'custom',
} as const;
