"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { Label } from "@/components/ui/Label";
import {
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  resetUserPassword,
  UsersPageData,
} from "@/app/(dashboard)/users/actions";

interface StatTileProps {
  label: string;
  value: number;
  description?: string;
}

function StatTile({ label, value, description }: StatTileProps) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <div className="text-xs font-medium text-text-muted">{label}</div>
      <div className="text-2xl font-bold text-text">{value}</div>
      {description && (
        <div className="text-xs text-text-muted">{description}</div>
      )}
    </Card>
  );
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
}

interface AddUserFormState {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  role: "OWNER" | "STAFF";
  status: "ACTIVE" | "DISABLED";
}

interface EditUserFormState {
  name: string;
  email: string;
  role: "OWNER" | "STAFF";
  status: "ACTIVE" | "DISABLED";
}

const emptyAddForm = (): AddUserFormState => ({
  name: "",
  email: "",
  password: "",
  passwordConfirm: "",
  role: "STAFF",
  status: "ACTIVE",
});

const emptyEditForm = (): EditUserFormState => ({
  name: "",
  email: "",
  role: "STAFF",
  status: "ACTIVE",
});

export function UsersClient({ data }: { data: UsersPageData }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "OWNER" | "STAFF">("");
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "DISABLED">(
    ""
  );

  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isResetPasswordDrawerOpen, setIsResetPasswordDrawerOpen] =
    useState(false);

  const [addForm, setAddForm] = useState<AddUserFormState>(emptyAddForm());
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditUserFormState>(emptyEditForm());
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const filteredUsers = useMemo(() => {
    return data.users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = !roleFilter || user.role === roleFilter;
      const matchesStatus = !statusFilter || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [data.users, searchTerm, roleFilter, statusFilter]);

  const handleAddUser = async () => {
    setError("");

    if (
      !addForm.name ||
      !addForm.email ||
      !addForm.password ||
      !addForm.passwordConfirm
    ) {
      setError("All fields are required");
      return;
    }

    if (addForm.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (addForm.password !== addForm.passwordConfirm) {
      setError("Passwords do not match");
      return;
    }

    if (!addForm.email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    try {
      await createUser({
        name: addForm.name,
        email: addForm.email,
        password: addForm.password,
        role: addForm.role,
        status: addForm.status,
      });

      setIsAddDrawerOpen(false);
      setAddForm(emptyAddForm());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditUser = async () => {
    setError("");

    if (!editingUser) return;

    if (!editForm.name || !editForm.email) {
      setError("Name and email are required");
      return;
    }

    if (!editForm.email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    try {
      await updateUser({
        id: editingUser.id,
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        status: editForm.status,
      });

      setIsEditDrawerOpen(false);
      setEditingUser(null);
      setEditForm(emptyEditForm());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");

    if (!resetPasswordUser) return;

    setIsLoading(true);
    try {
      const newPassword = await resetUserPassword(resetPasswordUser.id);
      setTempPassword(newPassword);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reset password"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (
      confirm(
        "Are you sure you want to deactivate this user? They will not be able to log in."
      )
    ) {
      try {
        await deactivateUser(userId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to deactivate user"
        );
      }
    }
  };

  const handleActivateUser = async (userId: string) => {
    try {
      await activateUser(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate user");
    }
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role as "OWNER" | "STAFF",
      status: user.status as "ACTIVE" | "DISABLED",
    });
    setError("");
    setIsEditDrawerOpen(true);
  };

  const handleOpenResetPassword = (user: User) => {
    setResetPasswordUser(user);
    setTempPassword("");
    setError("");
    setIsResetPasswordDrawerOpen(true);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-text mb-1">Users</h1>
        <p className="text-sm text-text-muted">
          Manage staff accounts and access
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label="Total Users"
          value={data.stats.total}
          description={`${data.stats.active} active`}
        />
        <StatTile
          label="Active Users"
          value={data.stats.active}
          description="Ready to use"
        />
        <StatTile
          label="Inactive Users"
          value={data.stats.inactive}
          description="Deactivated"
        />
        <StatTile
          label="Staff Users"
          value={data.stats.staff}
          description="Limited access"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Input
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />

        <Select
          value={roleFilter}
          onChange={(e) =>
            setRoleFilter(e.target.value as "" | "OWNER" | "STAFF")
          }
        >
          <option value="">All Roles</option>
          <option value="OWNER">Owner</option>
          <option value="STAFF">Staff</option>
        </Select>

        <Select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "" | "ACTIVE" | "DISABLED")
          }
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="DISABLED">Inactive</option>
        </Select>

        <Button
          onClick={() => {
            setSearchTerm("");
            setRoleFilter("");
            setStatusFilter("");
          }}
          variant="outline"
        >
          Clear
        </Button>

        <Button onClick={() => setIsAddDrawerOpen(true)}>+ Add User</Button>
      </div>

      <div className="text-sm text-text-muted">
        Showing {filteredUsers.length} of {data.users.length} users
      </div>

      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-3 text-left text-sm font-medium text-text">
                User
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text">
                Email
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text">
                Role
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text">
                Last Login
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text">
                Created
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-border hover:bg-surface">
                  <td className="px-4 py-3 text-sm text-text">{user.name}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {user.email}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant={user.role === "OWNER" ? "primary" : "secondary"}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge
                      variant={
                        user.status === "ACTIVE" ? "success" : "secondary"
                      }
                    >
                      {user.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {formatDate(user.lastLoginAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEdit(user)}
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleOpenResetPassword(user)}
                        className="text-amber-600 hover:text-amber-700 text-xs font-medium"
                      >
                        Reset Password
                      </button>
                      {user.status === "ACTIVE" ? (
                        <button
                          onClick={() => handleDeactivateUser(user.id)}
                          className="text-red-600 hover:text-red-700 text-xs font-medium"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivateUser(user.id)}
                          className="text-green-600 hover:text-green-700 text-xs font-medium"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Drawer
        isOpen={isAddDrawerOpen}
        onClose={() => {
          setIsAddDrawerOpen(false);
          setAddForm(emptyAddForm());
          setError("");
        }}
        title="Add User"
      >
        <div className="flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <Label>Name</Label>
            <Input
              value={addForm.name}
              onChange={(e) =>
                setAddForm({ ...addForm, name: e.target.value })
              }
              placeholder="Full name"
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={addForm.email}
              onChange={(e) =>
                setAddForm({ ...addForm, email: e.target.value })
              }
              placeholder="user@example.com"
            />
          </div>

          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={addForm.password}
              onChange={(e) =>
                setAddForm({ ...addForm, password: e.target.value })
              }
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <Label>Confirm Password</Label>
            <Input
              type="password"
              value={addForm.passwordConfirm}
              onChange={(e) =>
                setAddForm({ ...addForm, passwordConfirm: e.target.value })
              }
              placeholder="Re-enter password"
            />
          </div>

          <div>
            <Label>Role</Label>
            <Select
              value={addForm.role}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  role: e.target.value as "OWNER" | "STAFF",
                })
              }
            >
              <option value="STAFF">Staff</option>
              <option value="OWNER">Owner</option>
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={addForm.status}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  status: e.target.value as "ACTIVE" | "DISABLED",
                })
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Inactive</option>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleAddUser}
              disabled={isLoading}
            >
              {isLoading ? "Creating..." : "Create User"}
            </Button>
            <Button
              onClick={() => {
                setIsAddDrawerOpen(false);
                setAddForm(emptyAddForm());
                setError("");
              }}
              variant="outline"
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Drawer>

      <Drawer
        isOpen={isEditDrawerOpen}
        onClose={() => {
          setIsEditDrawerOpen(false);
          setEditingUser(null);
          setEditForm(emptyEditForm());
          setError("");
        }}
        title="Edit User"
      >
        <div className="flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <Label>Name</Label>
            <Input
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              placeholder="Full name"
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={editForm.email}
              onChange={(e) =>
                setEditForm({ ...editForm, email: e.target.value })
              }
              placeholder="user@example.com"
            />
          </div>

          <div>
            <Label>Role</Label>
            <Select
              value={editForm.role}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  role: e.target.value as "OWNER" | "STAFF",
                })
              }
            >
              <option value="STAFF">Staff</option>
              <option value="OWNER">Owner</option>
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={editForm.status}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  status: e.target.value as "ACTIVE" | "DISABLED",
                })
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Inactive</option>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleEditUser}
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              onClick={() => {
                setIsEditDrawerOpen(false);
                setEditingUser(null);
                setEditForm(emptyEditForm());
                setError("");
              }}
              variant="outline"
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Drawer>

      <Drawer
        isOpen={isResetPasswordDrawerOpen}
        onClose={() => {
          setIsResetPasswordDrawerOpen(false);
          setResetPasswordUser(null);
          setTempPassword("");
          setError("");
        }}
        title="Reset Password"
      >
        <div className="flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {!tempPassword && (
            <>
              <p className="text-sm text-text-muted">
                Reset password for <strong>{resetPasswordUser?.name}</strong>?
              </p>
              <p className="text-sm text-text-muted">
                A temporary password will be generated. You will need to
                communicate it to the user securely.
              </p>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleResetPassword} disabled={isLoading}>
                  {isLoading ? "Generating..." : "Generate Temporary Password"}
                </Button>
                <Button
                  onClick={() => {
                    setIsResetPasswordDrawerOpen(false);
                    setResetPasswordUser(null);
                    setError("");
                  }}
                  variant="outline"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}

          {tempPassword && (
            <>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs font-medium text-blue-700 mb-1">
                  Temporary Password
                </p>
                <p className="text-lg font-mono font-bold text-blue-900 mb-2">
                  {tempPassword}
                </p>
                <p className="text-xs text-blue-700">
                  Share this password securely with the user. They will be
                  prompted to change it on their first login.
                </p>
              </div>

              <Button
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword);
                  alert("Temporary password copied to clipboard");
                }}
              >
                Copy to Clipboard
              </Button>

              <Button
                onClick={() => {
                  setIsResetPasswordDrawerOpen(false);
                  setResetPasswordUser(null);
                  setTempPassword("");
                  setError("");
                }}
                variant="outline"
              >
                Done
              </Button>
            </>
          )}
        </div>
      </Drawer>
    </div>
  );
}
