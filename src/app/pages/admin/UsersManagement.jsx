import { useState, useMemo, useEffect, useCallback } from "react";
import { DataTable } from "../../components/shared/DataTable";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Plus, Edit, Trash2, Search, Eye, EyeOff } from "lucide-react";
import { Navigate } from "react-router";
import { ensureSystemUsersLoaded, getSystemUsers, SYSTEM_ROLES } from "../../store/systemUsersStore";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import { fetchRolesList, fetchUsersDirectory } from "../../services/usersDirectory";
import { createUserWithApi, updateUserWithApi, deleteUserWithApi } from "../../services/usersAdmin";
import { toast } from "sonner";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || "").trim());
}

function PasswordInput({ id, value, onChange, placeholder, autoComplete = "new-password", visible, onToggleVisible }) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={onToggleVisible}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function UsersManagement() {
  const { isOperator, isAdmin, canManageUsers, user } = useAuth();
  const canMutateUsers = canManageUsers();
  const canViewUsers = canMutateUsers || isAdmin();
  const requester = String(user?.username || user?.email || "").trim();
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    roleName: "Operator",
    status: "Active",
  });
  const [formError, setFormError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  // Roles are stored as `[{ id, name }]` so we can submit the integer `roleid` the backend
  // requires. When the API isn't available we fall back to legacy name-only entries (id null);
  // create/edit submission catches that and shows a clear error instead of silently posting
  // `roleid = 0` and creating role-less users.
  const [roles, setRoles] = useState(() => SYSTEM_ROLES.map((name) => ({ id: null, name })));
  const roleChoices = useMemo(() => roles.map((r) => r.name), [roles]);
  const findRoleId = useCallback(
    (name) => roles.find((r) => r.name === name)?.id ?? null,
    [roles],
  );

  const instContext = useMemo(
    () => ({
      // The backend's /users/create reads `body.role` as the calling admin's identity to
      // run GetUserRole(creator, sessiontoken). Surface it via context so service helpers
      // don't have to re-derive it from auth state.
      creator: requester,
      institutionCode: String(user?.institutionCode || "").trim(),
      institutionName: String(user?.institutionName || "").trim(),
    }),
    [requester, user?.institutionCode, user?.institutionName],
  );

  const refreshUserList = useCallback(async () => {
    try {
      const [apiUsers, apiRoles] = await Promise.all([
        fetchUsersDirectory().catch(() => []),
        fetchRolesList({ minId: 1, maxId: 3 }).catch(() => []),
      ]);
      if (apiUsers.length) {
        setUsers(apiUsers);
      } else {
        await ensureSystemUsersLoaded();
        setUsers(getSystemUsers());
      }
      if (apiRoles.length) {
        const apiNames = new Set(apiRoles.map((r) => r.name));
        const fillers = SYSTEM_ROLES.filter((name) => !apiNames.has(name)).map((name) => ({
          id: null,
          name,
        }));
        setRoles([...apiRoles, ...fillers]);
      } else {
        setRoles(SYSTEM_ROLES.map((name) => ({ id: null, name })));
      }
    } catch {
      await ensureSystemUsersLoaded();
      setUsers(getSystemUsers());
      setRoles(SYSTEM_ROLES.map((name) => ({ id: null, name })));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refreshUserList();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUserList]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.trim().toLowerCase();
    return users.filter(
      (u) =>
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && String(u.phone).toLowerCase().includes(q)) ||
        (u.roleName && u.roleName.toLowerCase().includes(q)) ||
        (u.status && u.status.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  const columns = [
    { key: "username", label: "Username", sortable: true },
    { key: "email", label: "Email", sortable: true },
    { key: "phone", label: "Phone" },
    { key: "roleName", label: "Role" },
    { key: "status", label: "Status" },
  ];

  const openEditModal = (user) => {
    setEditingUser(user);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setForm({
      username: user.username,
      email: user.email,
      password: "",
      confirmPassword: "",
      phone: user.phone || "",
      roleName: user.roleName,
      status: user.status,
    });
    setFormError("");
  };

  const saveEditUser = async () => {
    if (!editingUser) return;
    setFormError("");
    if (!form.username.trim()) {
      setFormError("Username is required.");
      return;
    }
    if (!form.email.trim()) {
      setFormError("Email is required.");
      return;
    }
    if (!isValidEmail(form.email)) {
      setFormError("Enter a valid email address (e.g. name@example.com).");
      return;
    }
    if (form.password && form.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    if (!requester) {
      setFormError("Your session is missing a username or email for the request.");
      return;
    }
    const roleId = findRoleId(form.roleName);
    if (roleId == null) {
      setFormError(
        `Role "${form.roleName}" doesn't have a server id loaded yet. Please reload the page so /roles/get can resolve the numeric role id.`,
      );
      return;
    }
    try {
      await updateUserWithApi(
        {
          id: editingUser.id,
          username: form.username.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          roleName: form.roleName,
          roleId,
          status: form.status,
          password: form.password || undefined,
          creator: requester,
        },
        instContext,
      );
      toast.success(
        isAdmin()
          ? "User updated successfully."
          : "User edit submitted for approval.",
      );
      setEditingUser(null);
      setForm({ username: "", email: "", password: "", confirmPassword: "", phone: "", roleName: "Operator", status: "Active" });
      await refreshUserList();
    } catch (e) {
      setFormError(e instanceof APIError ? e.message : "Unable to update user.");
    }
  };

  const confirmDeleteUser = (user) => {
    setUserToDelete(user);
  };

  const doDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteUserWithApi({ userId: userToDelete.id, username: userToDelete.username });
      toast.success("User deleted successfully.");
      setUserToDelete(null);
      await refreshUserList();
    } catch (e) {
      toast.error(e instanceof APIError ? e.message : "Unable to delete user.");
    }
  };

  const actions = (row) => (
    <div className="flex justify-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => openEditModal(row)} aria-label="Edit user"><Edit className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className="text-red-600" onClick={() => confirmDeleteUser(row)} aria-label="Delete user"><Trash2 className="w-4 h-4" /></Button>
    </div>
  );

  const createUser = async () => {
    setFormError("");
    if (!form.username.trim()) {
      setFormError("Username is required.");
      return;
    }
    if (!form.email.trim()) {
      setFormError("Email is required.");
      return;
    }
    if (!isValidEmail(form.email)) {
      setFormError("Enter a valid email address (e.g. name@example.com).");
      return;
    }
    if (!form.password) {
      setFormError("Password is required.");
      return;
    }
    if (form.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    if (!roleChoices.includes(form.roleName)) {
      setFormError("Please select a valid role.");
      return;
    }
    if (!requester) {
      setFormError("Your session is missing a username or email for the request.");
      return;
    }
    const roleId = findRoleId(form.roleName);
    if (roleId == null) {
      setFormError(
        `Role "${form.roleName}" doesn't have a server id loaded yet. Please reload the page so /roles/get can resolve the numeric role id.`,
      );
      return;
    }
    try {
      await createUserWithApi(
        {
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim(),
          roleName: form.roleName,
          roleId,
          status: form.status,
          creator: requester,
        },
        instContext,
      );
      toast.success("User created successfully.");
      setForm({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        phone: "",
        roleName: "Operator",
        status: "Active",
      });
      setOpen(false);
      await refreshUserList();
    } catch (e) {
      setFormError(e instanceof APIError ? e.message : "Unable to create user.");
    }
  };

  if (!canViewUsers) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-900">System Users</h1>
          <p className="text-2xl font-bold text-gray-900">Total: {users.length}</p>
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 max-w-2xl">
            {isAdmin()
              ? "Administrator creates, edits, and deletes users immediately."
              : isOperator()
                ? <>Add, edit, and delete actions are submitted for <strong>Approver</strong> review. Track requests under <strong>Approvals → Change requests</strong>.</>
                : "You can view system users."}
          </p>
        </div>
        {canMutateUsers ? (
          <Button
            className="gap-2 shrink-0"
            onClick={() => {
              setShowPassword(false);
              setShowConfirmPassword(false);
              setFormError("");
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4" /> Add User
          </Button>
        ) : null}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by username, email, phone, role or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          aria-label="Search users"
        />
      </div>

      <DataTable data={filteredUsers} columns={columns} actions={canMutateUsers ? actions : undefined} />

      <Dialog open={open && canMutateUsers} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New System User</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 max-h-[70vh] overflow-y-auto">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 shrink-0">{formError}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="new-username">Username</Label>
                <Input
                  id="new-username"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                />
              </div>
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="new-phone">Phone number</Label>
                <Input
                  id="new-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. +234 800 000 0000"
                />
              </div>
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label>User Role</Label>
                <Select
                  value={form.roleName}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, roleName: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleChoices.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="new-password">Password</Label>
                <PasswordInput
                  id="new-password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Min 8 characters"
                  visible={showPassword}
                  onToggleVisible={() => setShowPassword((v) => !v)}
                />
              </div>
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="new-confirm-password">Confirm password</Label>
                <PasswordInput
                  id="new-confirm-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm password"
                  visible={showConfirmPassword}
                  onToggleVisible={() => setShowConfirmPassword((v) => !v)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="min-w-[120px] space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User dialog */}
      <Dialog open={!!editingUser && canMutateUsers} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 max-h-[70vh] overflow-y-auto">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 shrink-0">{formError}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                />
              </div>
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="edit-phone">Phone number</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. +234 800 000 0000"
                />
              </div>
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label>User Role</Label>
                <Select
                  value={form.roleName}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, roleName: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleChoices.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="edit-password">New password (optional)</Label>
                <PasswordInput
                  id="edit-password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Leave blank to keep current"
                  visible={showPassword}
                  onToggleVisible={() => setShowPassword((v) => !v)}
                />
              </div>
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="edit-confirm-password">Confirm new password</Label>
                <PasswordInput
                  id="edit-confirm-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm if changing"
                  visible={showConfirmPassword}
                  onToggleVisible={() => setShowConfirmPassword((v) => !v)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="min-w-[120px] space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={saveEditUser}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!userToDelete && canMutateUsers} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-gray-600">
            Are you sure you want to delete <strong>{userToDelete?.username}</strong> ({userToDelete?.email})? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doDeleteUser}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
