import { getActiveBrandConfig } from "../../branding/brandRuntime";
import { readLocalStorage, setLocalStorage, STORAGE_KEY_NAMES } from "../config/storage";

const MOCK_DELAY_MS = 1200;
const ACTIVATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const FAKE_USER = {
  organizationName: "Central Clearing Bank",
  role: "Settlement Analyst",
  email: "j.smith@centralclearing.bank",
  maskedEmail: "j.***th@centralclearing.bank",
};

function getActivationProfiles() {
  const brand = getActiveBrandConfig();
  return {
    [`admin@${brand.mockBrand.emailDomain}`]: {
      organizationName: brand.mockBrand.organizationName,
      role: "Platform Administrator",
    },
    [`approver@${brand.mockBrand.emailDomain}`]: {
      organizationName: brand.mockBrand.organizationName,
      role: "Approver",
    },
    [`operator@${brand.mockBrand.emailDomain}`]: {
      organizationName: brand.mockBrand.organizationName,
      role: "Operator",
    },
    "j.smith@centralclearing.bank": {
      organizationName: "Central Clearing Bank",
      role: "Settlement Analyst",
    },
  };
}

const TOKEN_OUTCOMES = {
  valid: "valid",
  expired: "expired",
  used: "used",
  suspended: "suspended",
  invalid: "invalid",
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function maskEmail(email) {
  const normalized = normalizeEmail(email);
  const [localPart = "", domain = ""] = normalized.split("@");
  if (!localPart || !domain) return normalized;
  if (localPart.length <= 2) {
    return `${localPart[0] || ""}***@${domain}`;
  }
  return `${localPart.slice(0, 1)}${"*".repeat(Math.max(localPart.length - 2, 3))}${localPart.slice(-1)}@${domain}`;
}

function buildActivationUser(email) {
  const normalized = normalizeEmail(email);
  const profile = getActivationProfiles()[normalized] ?? {
    organizationName: getActiveBrandConfig().mockBrand.testEnvironmentName,
    role: "Institution User",
  };
  return {
    organizationName: profile.organizationName,
    role: profile.role,
    email: normalized,
    maskedEmail: maskEmail(normalized),
  };
}

function readStoredRequests() {
  try {
    const raw = readLocalStorage(STORAGE_KEY_NAMES.ACTIVATION_REQUESTS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredRequests(requests) {
  setLocalStorage(STORAGE_KEY_NAMES.ACTIVATION_REQUESTS, JSON.stringify(requests));
}

function createToken() {
  return `act-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-6)}`;
}

export async function requestActivationLink(email) {
  await wait(MOCK_DELAY_MS);

  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { success: false, message: "Enter the email address linked to your activation invitation." };
  }

  const token = createToken();
  const user = buildActivationUser(normalized);
  const requests = readStoredRequests();

  requests[token] = {
    status: TOKEN_OUTCOMES.valid,
    expiresAt: Date.now() + ACTIVATION_TOKEN_TTL_MS,
    user,
  };

  writeStoredRequests(requests);

  return {
    success: true,
    token,
    user,
    activationPath: `/activate/verify?token=${encodeURIComponent(token)}`,
    message: `An activation link has been sent to ${user.maskedEmail}.`,
  };
}

export async function validateToken(token) {
  await wait(MOCK_DELAY_MS);
  const normalized = (token || "").trim().toLowerCase();

  switch (normalized) {
    case "valid":
      return { status: TOKEN_OUTCOMES.valid, user: { ...FAKE_USER } };
    case "expired":
      return { status: TOKEN_OUTCOMES.expired, message: "This activation link has expired." };
    case "used":
      return { status: TOKEN_OUTCOMES.used, message: "This account has already been activated." };
    case "suspended":
      return { status: TOKEN_OUTCOMES.suspended, message: "This account has been suspended. Contact your administrator." };
    default:
      break;
  }

  const requests = readStoredRequests();
  const request = requests[token];
  if (!request) {
    return { status: TOKEN_OUTCOMES.invalid, message: "This activation link is invalid or has been revoked." };
  }

  if (request.status === TOKEN_OUTCOMES.used) {
    return { status: TOKEN_OUTCOMES.used, message: "This account has already been activated." };
  }

  if (request.status === TOKEN_OUTCOMES.suspended) {
    return { status: TOKEN_OUTCOMES.suspended, message: "This account has been suspended. Contact your administrator." };
  }

  if (Date.now() > request.expiresAt) {
    request.status = TOKEN_OUTCOMES.expired;
    writeStoredRequests(requests);
    return { status: TOKEN_OUTCOMES.expired, message: "This activation link has expired." };
  }

  return { status: TOKEN_OUTCOMES.valid, user: request.user };
}

export async function markActivationComplete(token) {
  if (!token) return;
  const requests = readStoredRequests();
  if (!requests[token]) return;
  requests[token].status = TOKEN_OUTCOMES.used;
  writeStoredRequests(requests);
}

export async function verifyOTP(otp) {
  await wait(800);
  if (!otp || otp.length !== 6) {
    return { success: false, message: "Enter the full 6-digit code." };
  }
  return { success: true };
}

export async function generateBackupCodes() {
  await wait(500);
  return Array.from({ length: 10 }, (_, i) =>
    `${String(i + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase()
  );
}

export { TOKEN_OUTCOMES, FAKE_USER };
