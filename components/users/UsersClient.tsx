"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import {
  createStaff,
  getStaffActivity,
  setStaffPassword,
  setStaffStatus,
  suggestUserId,
  updateStaff,
  updateStaffPermissions,
  type ActivityRow,
  type StaffRow,
  type UsersPageData,
} from "@/app/(dashboard)/users/actions";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { generatePassword } from "@/lib/password";
import { useSettings } from "@/components/providers/SettingsProvider";
import { SHOP_INFO } from "@/lib/shop-info";

const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Never";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <span className="text-2xl font-semibold text-text">{value}</span>
    </Card>
  );
}

type Credentials = { userId: string; password: string; name: string; id?: string; isNew?: boolean };

export function UsersClient({ data }: { data: UsersPageData }) {
  const router = useRouter();
  const MIN_PASSWORD_LENGTH = Number(useSettings().security.passwordMinLength) || 6;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");

  // Create / edit drawer
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [fName, setFName] = useState("");
  const [fContact, setFContact] = useState("");
  const [fUserId, setFUserId] = useState("");
  const [fPassword, setFPassword] = useState("");
  const [fRole, setFRole] = useState<"OWNER" | "STAFF">("STAFF");
  const [fStatus, setFStatus] = useState<"ACTIVE" | "DISABLED">("ACTIVE");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Credentials modal
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset password modal
  const [resetFor, setResetFor] = useState<StaffRow | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetError, setResetError] = useState("");

  // Permissions drawer
  const [permFor, setPermFor] = useState<StaffRow | null>(null);
  const [perms, setPerms] = useState<Set<string>>(new Set());

  // Activity modal
  const [activityFor, setActivityFor] = useState<StaffRow | null>(null);
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.users.filter((u) => {
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q) ||
        (u.contactNumber ?? "").toLowerCase().includes(q);
      const matchesStatus = !statusFilter || u.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data.users, search, statusFilter]);

  useEffect(() => {
    if (!activityFor) return;
    setActivity(null);
    getStaffActivity(activityFor.id)
      .then(setActivity)
      .catch(() => setActivity([]));
  }, [activityFor]);

  const openCreate = async () => {
    setEditing(null);
    setFName("");
    setFContact("");
    setFRole("STAFF");
    setFStatus("ACTIVE");
    setFPassword(generatePassword());
    setShowPw(true);
    setFormError("");
    setFUserId("");
    setFormOpen(true);
    try {
      setFUserId(await suggestUserId());
    } catch {
      /* the Owner can type one */
    }
  };

  const openEdit = (u: StaffRow) => {
    setEditing(u);
    setFName(u.name);
    setFContact(u.contactNumber ?? "");
    setFRole(u.role);
    setFormError("");
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await updateStaff({ id: editing.id, name: fName, contactNumber: fContact, role: fRole });
        setFormOpen(false);
      } else {
        const res = await createStaff({
          name: fName,
          contactNumber: fContact,
          userId: fUserId,
          password: fPassword,
          role: fRole,
          status: fStatus,
        });
        setFormOpen(false);
        setCreds({ userId: res.userId, password: res.password, name: fName.trim(), id: res.id, isNew: true });
      }
      router.refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u: StaffRow) => {
    const next = u.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    if (
      next === "DISABLED" &&
      !window.confirm(`Deactivate ${u.name} (${u.userId})? They will no longer be able to sign in.`)
    ) {
      return;
    }
    setError("");
    try {
      await setStaffStatus(u.id, next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status");
    }
  };

  const handleReset = async () => {
    if (!resetFor) return;
    setResetError("");
    try {
      const res = await setStaffPassword(resetFor.id, resetPw);
      setCreds({ userId: res.userId, password: res.password, name: resetFor.name });
      setResetFor(null);
      router.refresh();
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Could not reset password");
    }
  };

  const openPermissions = (u: StaffRow) => {
    setPermFor(u);
    setPerms(new Set(u.permissions));
    setFormError("");
  };

  const togglePerm = (group: (typeof PERMISSION_GROUPS)[number], key: string) => {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        if (key === group.viewKey) group.items.forEach((i) => next.delete(i.key));
      } else {
        next.add(key);
        if (group.viewKey) next.add(group.viewKey);
      }
      return next;
    });
  };

  const toggleGroup = (group: (typeof PERMISSION_GROUPS)[number]) => {
    setPerms((prev) => {
      const next = new Set(prev);
      const all = group.items.every((i) => next.has(i.key));
      group.items.forEach((i) => (all ? next.delete(i.key) : next.add(i.key)));
      return next;
    });
  };

  const savePermissions = async () => {
    if (!permFor) return;
    setSaving(true);
    setFormError("");
    try {
      await updateStaffPermissions(permFor.id, Array.from(perms));
      setPermFor(null);
      router.refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save permissions");
    } finally {
      setSaving(false);
    }
  };

  const copyCredentials = async () => {
    if (!creds) return;
    const text = `${SHOP_INFO.name}\nUser ID: ${creds.userId}\nPassword: ${creds.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy these credentials:", text);
    }
  };

  const formValid =
    fName.trim().length > 0 &&
    (editing || (fUserId.trim().length >= 3 && fPassword.length >= MIN_PASSWORD_LENGTH));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Users &amp; Staff</h1>
          <p className="text-sm text-text-muted">
            Create staff accounts, set what each person can access, and reset passwords.
          </p>
        </div>
        <Button onClick={openCreate}>+ Add Staff</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total Users" value={data.stats.total} />
        <StatTile label="Active" value={data.stats.active} />
        <StatTile label="Inactive" value={data.stats.inactive} />
        <StatTile label="Staff" value={data.stats.staff} />
      </div>

      <Card className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by name, User ID or contact number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-44"
        >
          <option value="">Status: All</option>
          <option value="ACTIVE">Active</option>
          <option value="DISABLED">Inactive</option>
        </Select>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-text-muted">
              <th className="px-3 py-2">User ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last Login</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-text-muted">
                  No staff found
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-text">{u.userId}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-text">{u.name}</div>
                    {u.createdByName && (
                      <div className="text-xs text-text-muted">by {u.createdByName}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-muted">{u.contactNumber || "-"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={u.role === "OWNER" ? "info" : "default"}>{u.role}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={u.status === "ACTIVE" ? "success" : "danger"}>
                      {u.status === "ACTIVE" ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-text-muted">{fmtDateTime(u.lastLoginAt)}</td>
                  <td className="px-3 py-2 text-text-muted">{fmtDate(u.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs font-medium">
                      {u.role === "STAFF" && (
                        <button className="text-accent hover:underline" onClick={() => openPermissions(u)}>
                          Permissions
                        </button>
                      )}
                      <button className="text-accent hover:underline" onClick={() => openEdit(u)}>
                        Edit
                      </button>
                      <button
                        className="text-accent hover:underline"
                        onClick={() => {
                          setResetFor(u);
                          setResetPw(generatePassword());
                          setResetError("");
                        }}
                      >
                        Reset Password
                      </button>
                      <button className="text-accent hover:underline" onClick={() => setActivityFor(u)}>
                        Activity
                      </button>
                      {u.id !== data.currentUserId && (
                        <button
                          className={u.status === "ACTIVE" ? "text-danger hover:underline" : "text-success hover:underline"}
                          onClick={() => toggleStatus(u)}
                        >
                          {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Create / edit */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Create Staff Account"}
        footer={
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!formValid || saving} className="flex-1">
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Staff Account"}
            </Button>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Full Name *</Label>
            <Input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Ram Kumar" />
          </div>
          <div>
            <Label>Contact Number</Label>
            <Input
              type="tel"
              value={fContact}
              onChange={(e) => setFContact(e.target.value)}
              placeholder="98XXXXXXXX"
            />
            <p className="mt-1 text-xs text-text-muted">
              For your reference only. It is not used to sign in.
            </p>
          </div>

          {editing ? (
            <div>
              <Label>User ID</Label>
              <Input value={editing.userId} disabled />
              <p className="mt-1 text-xs text-text-muted">The User ID can&apos;t be changed after creation.</p>
            </div>
          ) : (
            <>
              <div>
                <Label>User ID *</Label>
                <div className="flex gap-2">
                  <Input
                    value={fUserId}
                    onChange={(e) => setFUserId(e.target.value.toUpperCase())}
                    placeholder="U004"
                  />
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={async () => setFUserId(await suggestUserId())}
                  >
                    Generate
                  </Button>
                </div>
              </div>
              <div>
                <Label>Password *</Label>
                <div className="flex gap-2">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={fPassword}
                    onChange={(e) => setFPassword(e.target.value)}
                  />
                  <Button variant="secondary" type="button" onClick={() => setShowPw((s) => !s)}>
                    {showPw ? "Hide" : "Show"}
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setFPassword(generatePassword());
                      setShowPw(true);
                    }}
                  >
                    Generate
                  </Button>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  At least {MIN_PASSWORD_LENGTH} characters. You&apos;ll see it once after the account is created.
                </p>
              </div>
            </>
          )}

          <div>
            <Label>Role</Label>
            <Select value={fRole} onChange={(e) => setFRole(e.target.value as "OWNER" | "STAFF")}>
              <option value="STAFF">Staff (limited by permissions)</option>
              <option value="OWNER">Owner (full access, can manage users)</option>
            </Select>
            {fRole === "OWNER" && (
              <p className="mt-1 text-xs text-danger">
                Owners can see everything, including profit, and can manage all staff.
              </p>
            )}
          </div>

          {!editing && (
            <div>
              <Label>Status</Label>
              <Select value={fStatus} onChange={(e) => setFStatus(e.target.value as "ACTIVE" | "DISABLED")}>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Inactive</option>
              </Select>
            </div>
          )}

          {formError && <p className="text-sm text-danger">{formError}</p>}
        </div>
      </Drawer>

      {/* Credentials after create / reset */}
      <Modal
        isOpen={!!creds}
        onClose={() => setCreds(null)}
        title={creds?.isNew ? "Staff Created Successfully" : "Password Updated"}
        size="sm"
      >
        {creds && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-zinc-50 p-3 text-sm">
              <div className="mb-2 text-text-muted">{creds.name}</div>
              <div className="flex justify-between">
                <span className="text-text-muted">User ID</span>
                <span className="font-mono font-semibold">{creds.userId}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-text-muted">Password</span>
                <span className="font-mono font-semibold">{creds.password}</span>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              Share these with the staff member now. The password is stored encrypted and can&apos;t be shown again,
              but you can reset it any time.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={copyCredentials}>{copied ? "Copied!" : "Copy Credentials"}</Button>
              {creds.isNew && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const row = data.users.find((u) => u.id === creds.id);
                    setCreds(null);
                    if (row) openPermissions(row);
                    else router.refresh();
                  }}
                >
                  Set Permissions
                </Button>
              )}
              <Button variant="ghost" onClick={() => setCreds(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reset password */}
      <Modal
        isOpen={!!resetFor}
        onClose={() => setResetFor(null)}
        title={resetFor ? `Reset Password - ${resetFor.userId}` : ""}
        size="sm"
      >
        {resetFor && (
          <div className="space-y-4">
            <div>
              <Label>New Password</Label>
              <div className="flex gap-2">
                <Input value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
                <Button variant="secondary" type="button" onClick={() => setResetPw(generatePassword())}>
                  Generate
                </Button>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Type your own or generate one. At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>
            {resetError && <p className="text-sm text-danger">{resetError}</p>}
            <div className="flex gap-2">
              <Button
                onClick={handleReset}
                disabled={resetPw.length < MIN_PASSWORD_LENGTH}
                className="flex-1"
              >
                Set Password
              </Button>
              <Button variant="ghost" onClick={() => setResetFor(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Permissions */}
      <Drawer
        open={!!permFor}
        onClose={() => setPermFor(null)}
        title={permFor ? `Permissions - ${permFor.name} (${permFor.userId})` : "Permissions"}
        width="w-[640px]"
        footer={
          <div className="flex items-center gap-2">
            <Button onClick={savePermissions} disabled={saving} className="flex-1">
              {saving ? "Saving..." : "Save Permissions"}
            </Button>
            <Button variant="ghost" onClick={() => setPermFor(null)}>
              Cancel
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <p className="text-xs text-text-muted">
            Only the Owner can change these. Changes apply the next time the staff member opens a page. User
            management is always Owner-only.
          </p>
          {PERMISSION_GROUPS.map((group) => {
            const allOn = group.items.every((i) => perms.has(i.key));
            return (
              <div key={group.key}>
                <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
                  <h3 className="text-sm font-semibold text-text">{group.label}</h3>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {allOn ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm text-text">
                      <input
                        type="checkbox"
                        checked={perms.has(item.key)}
                        onChange={() => togglePerm(group, item.key)}
                        className="h-4 w-4 accent-orange-600"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {formError && <p className="text-sm text-danger">{formError}</p>}
        </div>
      </Drawer>

      {/* Activity */}
      <Modal
        isOpen={!!activityFor}
        onClose={() => setActivityFor(null)}
        title={activityFor ? `Activity - ${activityFor.name}` : ""}
        size="md"
      >
        <div className="max-h-[60vh] overflow-y-auto">
          {activity === null ? (
            <p className="py-6 text-center text-sm text-text-muted">Loading...</p>
          ) : activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">No activity yet</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {activity.map((a) => (
                <li key={a.id} className="flex justify-between gap-3 py-2">
                  <span className="text-text first-letter:uppercase">{a.label}</span>
                  <span className="shrink-0 text-xs text-text-muted">{fmtDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  );
}
