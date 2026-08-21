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
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import { StatusBadge } from "../../components/shared/StatusBadge";
import {
  fetchLinkedEntitiesForRole,
  fetchOtherUsersDirectoryWithPending,
  fetchRolesList,
} from "../../services/usersDirectory";
import { createOtherUserWithApi, updateUserWithApi, deleteUserWithApi } from "../../services/usersAdmin";
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

const emptyForm = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  roleName: "",
  institutionId: "",
  status: "Active",
};

export default function OtherUsers() {
  const { isOperator, isAdmin, canManageUsers, user } = useAuth();
  const canMutateUsers = canManageUsers();
  const canViewUsers = canMutateUsers || isAdmin();
  const requester = String(user?.username || user?.email || "").trim();
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingUser, setEditingUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [roles, setRoles] = useState([]);
  const [entities, setEntities] = useState([]);
  const roleChoices = useMemo(() => roles.map((r) => r.name), [roles]);
  const findRole = useCallback(
    (name) => roles.find((r) => r.name === name) ?? null,
    [roles],
  );

  const refreshUserList = useCallback(async () => {
    try {
      const [apiUsers, apiRoles] = await Promise.all([
        fetchOtherUsersDirectoryWithPending().catch(() => []),
        fetchRolesList({ minId: 4, maxId: 8 }).catch(() => []),
      ]);
      setUsers(apiUsers);
      setRoles(apiRoles);
      setForm((prev) => ({
        ...prev,
        roleName: prev.roleName || apiRoles[0]?.name || "",
      }));
    } catch {
      setUsers([]);
      setRoles([]);
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

  const selectedRoleId = findRole(form.roleName)?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedRoleId) {
        setEntities([]);
        return;
      }
      const list = await fetchLinkedEntitiesForRole(selectedRoleId).catch(() => []);
      if (!cancelled) {
        setEntities(list);
        setForm((prev) => {
          if (list.some((item) => item.id === prev.institutionId)) return prev;
          return { ...prev, institutionId: "" };
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRoleId]);

  const statusOptions = useMemo(() => {
    const seen = new Set();
    for (const u of users) {
      const s = String(u?.status || "").trim();
      if (s) seen.add(s);
    }
    const preferred = ["Active", "Pending Approval", "Pending Edit", "Pending Delete", "Inactive"];
    const ordered = preferred.filter((s) => seen.has(s));
    for (const s of [...seen].sort()) {
      if (!ordered.includes(s)) ordered.push(s);
    }
    return ordered;
  }, [users]);

  const filteredUsers = useMemo(() => {
    let list = users;
    if (statusFilter !== "all") {
      const want = statusFilter.toLowerCase();
      list = list.filter((u) => String(u.status || "").toLowerCase() === want);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter(
      (u) =>
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && String(u.phone).toLowerCase().includes(q)) ||
        (u.roleName && u.roleName.toLowerCase().includes(q)) ||
        (u.institutionName && u.institutionName.toLowerCase().includes(q)) ||
        (u.status && u.status.toLowerCase().includes(q))
    );
  }, [users, searchQuery, statusFilter]);

  const columns = [
    { key: "username", label: "Username", sortable: true },
    { key: "email", label: "Email", sortable: true },
    { key: "phone", label: "Phone" },
    { key: "roleName", label: "Role" },
    { key: "institutionName", label: "Institution" },
    {
      key: "status",
      label: "Status",
      render: (_value, row) => <StatusBadge status={row?.status || "Active"} />,
    },
  ];

  const openEditModal = (row) => {
    if (row?.isPendingCreate || row?.pendingAction) return;
    setEditingUser(row);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setForm({
      username: row.username,
      email: row.email,
      password: "",
      confirmPassword: "",
      phone: row.phone || "",
      roleName: row.roleName,
      institutionId: row.institutionCode || "",
      status: row.status,
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
    const role = findRole(form.roleName);
    if (role?.id == null) {
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
          roleId: role.id,
          status: form.status,
          password: form.password || undefined,
          creator: requester,
        },
        { creator: requester },
      );
      toast.success(
        isAdmin()
          ? "User updated successfully."
          : "User edit submitted for approval.",
      );
      setEditingUser(null);
      setForm({ ...emptyForm, roleName: roles[0]?.name || "" });
      await refreshUserList();
    } catch (e) {
      setFormError(e instanceof APIError ? e.message : "Unable to update user.");
    }
  };

  const doDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteUserWithApi({ userId: userToDelete.id, username: userToDelete.username });
      toast.success(
        isAdmin()
          ? "User deleted successfully."
          : "User delete submitted for approval.",
      );
      setUserToDelete(null);
      await refreshUserList();
    } catch (e) {
      toast.error(e instanceof APIError ? e.message : "Unable to delete user.");
    }
  };

  const actions = (row) => {
    if (row?.isPendingCreate || row?.pendingAction) {
      return (
        <span className="text-xs text-amber-700" title="Awaiting Approver review">
          Pending
        </span>
      );
    }
    return (
      <div className="flex justify-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => openEditModal(row)} aria-label="Edit user"><Edit className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setUserToDelete(row)} aria-label="Delete user"><Trash2 className="w-4 h-4" /></Button>
      </div>
    );
  };

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
    const role = findRole(form.roleName);
    if (role?.id == null) {
      setFormError("Please select a valid role.");
      return;
    }
    const entity = entities.find((item) => item.id === form.institutionId);
    if (!entity) {
      setFormError("Please select a linked institution.");
      return;
    }
    if (!requester) {
      setFormError("Your session is missing a username or email for the request.");
      return;
    }
    try {
      await createOtherUserWithApi(
        {
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim(),
          roleName: form.roleName,
          roleId: role.id,
          status: form.status,
          creator: requester,
        },
        {
          creator: requester,
          institutionCode: entity.id,
          institutionName: entity.name,
        },
      );
      toast.success(
        isAdmin()
          ? "User created successfully."
          : "User create submitted for approval.",
      );
      setForm({ ...emptyForm, roleName: roles[0]?.name || "" });
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
          <h1 className="text-3xl font-bold text-gray-900">Other Users</h1>
          <p className="text-2xl font-bold text-gray-900">Total: {filteredUsers.length}</p>
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 max-w-2xl">
            {isAdmin()
              ? "Administrator creates, edits, and deletes other users (roles 4–8) immediately."
              : isOperator()
                ? <>Add, edit, and delete actions are submitted for <strong>Approver</strong> review. Pending requests appear in this table as <strong>Pending Approval</strong> (also under <strong>Approvals → Pending User Approvals</strong>).</>
                : "You can view other users."}
          </p>
        </div>
        {canMutateUsers ? (
          <Button
            className="gap-2 shrink-0"
            onClick={() => {
              setShowPassword(false);
              setShowConfirmPassword(false);
              setFormError("");
              setForm({ ...emptyForm, roleName: roles[0]?.name || "" });
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4" /> Add User
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by username, email, role or institution..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search other users"
          />
        </div>
        <div className="w-[200px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable data={filteredUsers} columns={columns} actions={canMutateUsers ? actions : undefined} />

      <Dialog open={open && canMutateUsers} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Other User</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 max-h-[70vh] overflow-y-auto">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 shrink-0">{formError}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="other-username">Username</Label>
                <Input
                  id="other-username"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                />
              </div>
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="other-email">Email</Label>
                <Input
                  id="other-email"
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
                <Label htmlFor="other-phone">Phone number</Label>
                <Input
                  id="other-phone"
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
                  onValueChange={(value) => setForm((prev) => ({ ...prev, roleName: value, institutionId: "" }))}
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
            <div className="space-y-1.5">
              <Label>Linked institution</Label>
              <Select
                value={form.institutionId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, institutionId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={entities.length ? "Select institution" : "No institutions loaded"} />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="other-password">Password</Label>
                <PasswordInput
                  id="other-password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Min 8 characters"
                  visible={showPassword}
                  onToggleVisible={() => setShowPassword((v) => !v)}
                />
              </div>
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="other-confirm-password">Confirm password</Label>
                <PasswordInput
                  id="other-confirm-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm password"
                  visible={showConfirmPassword}
                  onToggleVisible={() => setShowConfirmPassword((v) => !v)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser && canMutateUsers} onOpenChange={(openState) => !openState && setEditingUser(null)}>
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
                <Label htmlFor="edit-other-username">Username</Label>
                <Input
                  id="edit-other-username"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                />
              </div>
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="edit-other-email">Email</Label>
                <Input
                  id="edit-other-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="edit-other-phone">Phone number</Label>
                <Input
                  id="edit-other-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
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
                <Label htmlFor="edit-other-password">New password (optional)</Label>
                <PasswordInput
                  id="edit-other-password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Leave blank to keep current"
                  visible={showPassword}
                  onToggleVisible={() => setShowPassword((v) => !v)}
                />
              </div>
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="edit-other-confirm-password">Confirm new password</Label>
                <PasswordInput
                  id="edit-other-confirm-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm if changing"
                  visible={showConfirmPassword}
                  onToggleVisible={() => setShowConfirmPassword((v) => !v)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={saveEditUser}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!userToDelete && canMutateUsers} onOpenChange={(openState) => !openState && setUserToDelete(null)}>
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
