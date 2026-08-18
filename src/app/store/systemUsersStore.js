import seededUsers from "@system-users-seed";
import { getActiveBrandConfig } from "../../branding/brandRuntime";

const SYSTEM_ROLES = ["Admin", "Approver", "Operator"];
const MOCK_AUTH_ENABLED = String(import.meta.env.VITE_ENABLE_MOCK_AUTH ?? "false").toLowerCase() === "true";

let users = cloneUsers(MOCK_AUTH_ENABLED ? getSeededUsers() : []);
let initialized = true;
let loadedBrandId = getActiveBrandConfig().id;

function cloneUsers(list) {
  return list.map((user) => ({ ...user }));
}

function getSeededUsers() {
  if (!MOCK_AUTH_ENABLED) return [];
  const brandUsers = typeof seededUsers === "function" ? seededUsers() : seededUsers;
  return Array.isArray(brandUsers) ? brandUsers : [];
}

export async function ensureSystemUsersLoaded() {
  const activeBrandId = getActiveBrandConfig().id;
  if (!initialized || loadedBrandId !== activeBrandId) {
    users = cloneUsers(MOCK_AUTH_ENABLED ? getSeededUsers() : []);
    initialized = true;
    loadedBrandId = activeBrandId;
  }
  return users;
}

export function getSystemUsers() {
  return users.filter((u) => SYSTEM_ROLES.includes(u.roleName));
}

export function addSystemUser(user) {
  const id = `U${String(users.length + 1).padStart(3, "0")}`;
  const newUser = {
    id,
    username: user.username.trim(),
    email: user.email.trim().toLowerCase(),
    password: user.password,
    phone: (user.phone || "").trim(),
    roleName: user.roleName,
    status: user.status || "Active",
    mustChangePassword: true,
  };
  users = [newUser, ...users];
  return newUser;
}

export function findSystemUserByEmail(email) {
  const normalized = (email || "").trim().toLowerCase();
  return users.find((u) => u.email === normalized && SYSTEM_ROLES.includes(u.roleName));
}

export async function validateCredentials(email, password) {
  await ensureSystemUsersLoaded();
  const brandDomain = getActiveBrandConfig().mockBrand.emailDomain;
  if (email && !String(email).toLowerCase().endsWith(`@${brandDomain}`)) {
    return null;
  }
  const user = findSystemUserByEmail(email);
  if (!user || user.status !== "Active") return null;
  if (user.password !== password) return null;
  return { ...user };
}

export function updateUserPassword(userId, newPassword) {
  const u = users.find((x) => x.id === userId);
  if (!u) return false;
  u.password = newPassword;
  u.mustChangePassword = false;
  return true;
}

export function setMustChangePassword(userId, value) {
  const u = users.find((x) => x.id === userId);
  if (!u) return false;
  u.mustChangePassword = !!value;
  return true;
}

export function updateSystemUser(userId, updates) {
  const u = users.find((x) => x.id === userId);
  if (!u) return false;
  if (updates.username != null) u.username = String(updates.username).trim();
  if (updates.email != null) u.email = String(updates.email).trim().toLowerCase();
  if (updates.phone != null) u.phone = String(updates.phone).trim();
  if (updates.roleName != null && SYSTEM_ROLES.includes(updates.roleName)) u.roleName = updates.roleName;
  if (updates.status != null) u.status = updates.status;
  if (updates.password != null && updates.password.length >= 8) {
    u.password = updates.password;
    u.mustChangePassword = updates.requirePasswordChange !== false;
  }
  return true;
}

export function deleteSystemUser(userId) {
  const idx = users.findIndex((x) => x.id === userId);
  if (idx === -1) return false;
  users.splice(idx, 1);
  return true;
}

export { SYSTEM_ROLES };
