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
import { Plus, Edit, Trash2, Search, ShieldCheck } from "lucide-react";
import { Navigate } from "react-router";
import { ensureSystemUsersLoaded, getSystemUsers, SYSTEM_ROLES } from "../../store/systemUsersStore";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { fetchRolesList, fetchUsersDirectoryWithPending } from "../../services/usersDirectory";
import { createUserWithApi, updateUserWithApi, deleteUserWithApi, resetUser2faWithApi } from "../../services/usersAdmin";
import {
  canDeleteSystemUser,
  filterSystemRolesForCreate,
  filterSystemRolesForEdit,
  isAdministratorAccount,
  isAdministratorRoleId,
  isAdministratorRoleLabel,
  ROLE_IDS,
} from "../../utils/roleAccess";
import { toast } from "sonner";
import {
  isValidNgPhoneLocal,
  toLocalPhoneDigits,
  toStoredPhoneNumber,
} from "../../utils/phone";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || "").trim());
}

const PHONE_ERROR = "Enter a valid 10-digit mobile number (e.g. 8012345678).";

function titleCaseName(value) {
  const s = String(value || "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  return s
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export default function UsersManagement() {
  const { isOperator, isAdmin, canManageUsers, user } = useAuth();
  const canMutateUsers = canManageUsers();
  const canViewUsers = canMutateUsers || isAdmin();
  const requester = String(user?.username || user?.email || "").trim();
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    roleName: "Operator",
    status: "Active",
  });
  const [formError, setFormError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingUser, setEditingUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [userToReset2fa, setUserToReset2fa] = useState(null);
  // Roles are stored as `[{ id, name }]` so we can submit the integer `roleid` the backend
  // requires. When the API isn't available we fall back to legacy name-only entries (id null);
  // create/edit submission catches that and shows a clear error instead of silently posting
  // `roleid = 0` and creating role-less users.
  const [roles, setRoles] = useState(() => SYSTEM_ROLES.map((name) => ({ id: null, name })));
  const createRoleChoices = useMemo(
    () => filterSystemRolesForCreate(roles).map((r) => r.name),
    [roles],
  );
  const editRoleChoices = useMemo(
    () =>
      filterSystemRolesForEdit(roles, {
        actorIsOperator: isOperator(),
        targetIsAdmin: isAdministratorAccount(editingUser),
      }).map((r) => r.name),
    [roles, editingUser, isOperator],
  );
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
        fetchUsersDirectoryWithPending().catch(() => []),
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

  const statusOptions = useMemo(() => {
    const seen = new Set();
    for (const u of users) {
      const s = String(u?.status || "").trim();
      if (s) seen.add(s);
    }
    const preferred = ["Active", "Pending Approval", "Pending Edit", "Pending Delete", "Pending 2FA Reset", "Inactive"];
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
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && String(u.phone).toLowerCase().includes(q)) ||
        (u.roleName && u.roleName.toLowerCase().includes(q)) ||
        (u.status && u.status.toLowerCase().includes(q))
    );
  }, [users, searchQuery, statusFilter]);

  const columns = [
    {
      key: "fullName",
      label: "Full Name",
      sortable: true,
      render: (value) => titleCaseName(value) || "—",
    },
    { key: "email", label: "Email", sortable: true },
    { key: "phone", label: "Phone" },
    {
      key: "roleName",
      label: "Role",
      render: (value) => titleCaseName(value) || value || "—",
    },
    {
      key: "status",
      label: "Status",
      render: (_value, row) => <StatusBadge status={row?.status || "Active"} />,
    },
  ];

  const openEditModal = (user) => {
    if (user?.isPendingCreate || user?.pendingAction) return;
    setEditingUser(user);
    setForm({
      username: titleCaseName(user.fullName || user.username),
      email: user.email,
      phone: toLocalPhoneDigits(user.phone),
      roleName: user.roleName,
      status: user.status,
    });
    setFormError("");
  };

  const saveEditUser = async () => {
    if (!editingUser) return;
    setFormError("");
    if (!form.username.trim()) {
      setFormError("Full name is required.");
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
    if (!isValidNgPhoneLocal(form.phone)) {
      setFormError(PHONE_ERROR);
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
    if (isOperator()
        && (isAdministratorRoleId(roleId) || isAdministratorRoleLabel(form.roleName))
        && !isAdministratorAccount(editingUser)) {
      setFormError("Operators cannot assign the Administrator role.");
      return;
    }
    try {
      await updateUserWithApi(
        {
          id: editingUser.id,
          username: form.username.trim(),
          email: form.email.trim(),
          phone: toStoredPhoneNumber(form.phone),
          roleName: form.roleName,
          roleId,
          status: form.status,
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
      setForm({ username: "", email: "", phone: "", roleName: "Operator", status: "Active" });
      await refreshUserList();
    } catch (e) {
      setFormError(e instanceof APIError ? e.message : "Unable to update user.");
    }
  };

  const confirmDeleteUser = (row) => {
    if (!canDeleteSystemUser(row)) {
      toast.error("Administrator accounts cannot be deleted.");
      return;
    }
    setUserToDelete(row);
  };

  const doDeleteUser = async () => {
    if (!userToDelete) return;
    if (!canDeleteSystemUser(userToDelete)) {
      toast.error("Administrator accounts cannot be deleted.");
      setUserToDelete(null);
      return;
    }
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

  const doReset2fa = async () => {
    if (!userToReset2fa) return;
    if (!requester) {
      toast.error("Your session is missing a username or email for the request.");
      return;
    }
    try {
      await resetUser2faWithApi({
        id: userToReset2fa.id,
        email: userToReset2fa.email,
        creator: requester,
      });
      toast.success(
        isAdmin()
          ? "2FA reset successfully. The user must set up 2FA again on next login."
          : "2FA reset submitted for approval.",
      );
      setUserToReset2fa(null);
      await refreshUserList();
    } catch (e) {
      toast.error(e instanceof APIError ? e.message : "Unable to reset 2FA.");
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
    const allowDelete = canDeleteSystemUser(row);
    return (
      <div className="flex justify-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => openEditModal(row)} aria-label="Edit user"><Edit className="w-4 h-4" /></Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-amber-700"
          onClick={() => setUserToReset2fa(row)}
          aria-label="Reset 2FA"
          title="Reset 2FA"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
        </Button>
        {allowDelete ? (
          <Button variant="ghost" size="icon" className="text-red-600" onClick={() => confirmDeleteUser(row)} aria-label="Delete user"><Trash2 className="w-4 h-4" /></Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-300"
            disabled
            aria-label="Administrator accounts cannot be deleted"
            title="Administrator accounts cannot be deleted"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  };

  const createUser = async () => {
    setFormError("");
    if (!form.username.trim()) {
      setFormError("Full name is required.");
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
    if (!isValidNgPhoneLocal(form.phone)) {
      setFormError(PHONE_ERROR);
      return;
    }
    if (!createRoleChoices.includes(form.roleName)) {
      setFormError("Please select a valid role. Administrator accounts cannot be created here.");
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
    if (roleId === ROLE_IDS.ADMINISTRATOR || isAdministratorRoleLabel(form.roleName)) {
      setFormError("Creating Administrator accounts is not allowed.");
      return;
    }
    try {
      await createUserWithApi(
        {
          username: form.username.trim(),
          email: form.email.trim(),
          phone: toStoredPhoneNumber(form.phone),
          roleName: form.roleName,
          roleId,
          status: form.status,
          creator: requester,
        },
        instContext,
      );
      toast.success(
        isAdmin()
          ? "User created successfully."
          : "User create submitted for approval.",
      );
      setForm({
        username: "",
        email: "",
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
          <p className="text-2xl font-bold text-gray-900">Total: {filteredUsers.length}</p>
        </div>
        {canMutateUsers ? (
          <Button
            className="gap-2 shrink-0"
            onClick={() => {
              setFormError("");
              setForm({
                username: "",
                email: "",
                phone: "",
                roleName: createRoleChoices[0] || "Operator",
                status: "Active",
              });
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
            placeholder="Search by full name, email, phone, role or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search users"
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
            <DialogTitle>Create New System User</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 max-h-[70vh] overflow-y-auto">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 shrink-0">{formError}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="new-username">Full Name</Label>
                <Input
                  id="new-username"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter full name"
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
                <div className="border-input flex h-9 w-full items-center overflow-hidden rounded-md border bg-input-background">
                  <span className="text-muted-foreground shrink-0 select-none border-r px-3 text-sm">+234</span>
                  <Input
                    id="new-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      }))
                    }
                    placeholder="8012345678"
                    maxLength={10}
                    className="h-full border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                </div>
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
                    {createRoleChoices.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label htmlFor="edit-username">Full Name</Label>
                <Input
                  id="edit-username"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter full name"
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
                <div className="border-input flex h-9 w-full items-center overflow-hidden rounded-md border bg-input-background">
                  <span className="text-muted-foreground shrink-0 select-none border-r px-3 text-sm">+234</span>
                  <Input
                    id="edit-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      }))
                    }
                    placeholder="8012345678"
                    maxLength={10}
                    className="h-full border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                </div>
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
                    {editRoleChoices.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            Are you sure you want to delete <strong>{userToDelete?.fullName || userToDelete?.username}</strong> ({userToDelete?.email})? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doDeleteUser}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!userToReset2fa && canMutateUsers} onOpenChange={(open) => !open && setUserToReset2fa(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset 2FA</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-gray-600">
            Reset two-factor authentication for{" "}
            <strong>{userToReset2fa?.fullName || userToReset2fa?.username}</strong> ({userToReset2fa?.email})?
            They will set up 2FA again on their next login.
            {!isAdmin() ? " This will be submitted for approval." : ""}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToReset2fa(null)}>Cancel</Button>
            <Button onClick={doReset2fa}>Reset 2FA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
