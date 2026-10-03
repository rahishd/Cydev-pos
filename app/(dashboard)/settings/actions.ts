"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertOwner, assertPermission, getAccess } from "@/lib/access";
import { getSettings, getStoredSettings, saveSettingsData } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import {
  SETTINGS_SECTIONS,
  cleanSectionValues,
  type SettingsSectionId,
  type SettingsValues,
} from "@/lib/settings-schema";

export type SettingsPageData = {
  settings: SettingsValues;
  sections: SettingsSectionId[];
  isOwner: boolean;
};

/** Sections the signed-in user may open: the Owner sees all, staff only those granted. */
function visibleSections(can: (p: string) => boolean): SettingsSectionId[] {
  return SETTINGS_SECTIONS.filter((s) => can(s.permission)).map((s) => s.id);
}

export async function getSettingsPageData(): Promise<SettingsPageData> {
  const access = await getAccess();
  if (!access) throw new Error("Please sign in again.");
  const sections = visibleSections(access.can);
  if (sections.length === 0) throw new Error("You don't have access to Settings.");
  return { settings: await getSettings(), sections, isOwner: access.isOwner };
}

function sectionById(id: string) {
  const section = SETTINGS_SECTIONS.find((s) => s.id === id);
  if (!section) throw new Error("Unknown settings section");
  return section;
}

export async function saveSettingsSection(sectionId: string, values: Record<string, unknown>) {
  const section = sectionById(sectionId);
  const access = await assertPermission(section.permission);
  const cleaned = cleanSectionValues(section, values);

  const stored = await getStoredSettings();
  const previous = { ...(stored[section.id] ?? {}) };
  const next = { ...previous, ...cleaned };
  // A field never saved before is effectively at its default, so only real differences count.
  const wasValue = (k: string) => previous[k] ?? section.fields.find((f) => f.key === k)?.default;
  const changed = Object.keys(cleaned).filter(
    (k) => JSON.stringify(wasValue(k)) !== JSON.stringify(cleaned[k])
  );

  await saveSettingsData({ ...stored, [section.id]: next });

  if (changed.length > 0) {
    const show = (v: unknown, f?: { options?: { value: string; label: string }[]; suffix?: string }) => {
      if (v === undefined || v === null || v === "") return "(empty)";
      if (typeof v === "boolean") return v ? "ON" : "OFF";
      if (Array.isArray(v)) return v.join(", ") || "(empty)";
      const label = f?.options?.find((o) => o.value === String(v))?.label ?? String(v);
      return f?.suffix ? `${label}${f.suffix}` : label;
    };
    const lines = changed.map((k) => {
      const f = section.fields.find((x) => x.key === k);
      const before = wasValue(k);
      return `${f?.label ?? k}: ${show(before, f)} -> ${show(cleaned[k], f)}`;
    });
    await logAudit({
      actor: access,
      action: "settings_changed",
      title: `${section.label} Settings Changed`,
      module: "Settings",
      entityType: "Settings",
      entityId: section.id,
      description: lines.join("; ").slice(0, 600),
      previous: Object.fromEntries(changed.map((k) => [section.fields.find((x) => x.key === k)?.label ?? k, previous[k] ?? section.fields.find((x) => x.key === k)?.default ?? null])),
      next: Object.fromEntries(changed.map((k) => [section.fields.find((x) => x.key === k)?.label ?? k, cleaned[k]])),
    });
  }

  revalidatePath("/", "layout");
  return { changed: changed.length };
}

const MAX_LOGO_CHARS = 250_000;

export async function saveBusinessLogo(dataUrl: string | null) {
  const access = await assertPermission("settings.shop");
  if (dataUrl !== null) {
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
      throw new Error("The logo must be a PNG or JPG image");
    }
    if (dataUrl.length > MAX_LOGO_CHARS) throw new Error("The logo is too large. Use an image under about 180 KB.");
  }

  const stored = await getStoredSettings();
  const business = { ...(stored.business ?? {}) };
  if (dataUrl) business.logo = dataUrl;
  else delete business.logo;
  await saveSettingsData({ ...stored, business });

  await logAudit({
    actor: access,
    action: "settings_changed",
    title: "Shop Logo Changed",
    module: "Settings",
    entityType: "Settings",
    entityId: "business",
    description: dataUrl ? "Shop logo updated" : "Shop logo removed",
  });

  revalidatePath("/", "layout");
}

// ---------- Expense categories ----------

export type ExpenseCategoryRow = { id: string; name: string; isActive: boolean; used: number };

export async function getExpenseCategories(): Promise<ExpenseCategoryRow[]> {
  await assertPermission("settings.system");
  const rows = await prisma.expenseCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, isActive: true, _count: { select: { expenses: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, isActive: r.isActive, used: r._count.expenses }));
}

export async function createExpenseCategoryAction(name: string) {
  const access = await assertPermission("settings.system");
  const clean = name.trim();
  if (!clean) throw new Error("Category name is required");
  const existing = await prisma.expenseCategory.findFirst({
    where: { name: { equals: clean, mode: "insensitive" } },
  });
  if (existing) throw new Error("That category already exists");
  const cat = await prisma.expenseCategory.create({ data: { name: clean } });
  await logAudit({
    actor: access,
    action: "created",
    title: "Created Expense Category",
    module: "Expenses",
    entityType: "ExpenseCategory",
    entityId: cat.id,
    description: `Created expense category "${clean}"`,
    next: { name: clean },
  });
  revalidatePath("/expenses");
}

export async function renameExpenseCategory(id: string, name: string) {
  const access = await assertPermission("settings.system");
  const clean = name.trim();
  if (!clean) throw new Error("Category name is required");
  const clash = await prisma.expenseCategory.findFirst({
    where: { name: { equals: clean, mode: "insensitive" }, id: { not: id } },
  });
  if (clash) throw new Error("That category already exists");
  const before = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!before) throw new Error("Category not found");
  await prisma.expenseCategory.update({ where: { id }, data: { name: clean } });
  await logAudit({
    actor: access,
    action: "updated",
    title: "Renamed Expense Category",
    module: "Expenses",
    entityType: "ExpenseCategory",
    entityId: id,
    description: `Renamed expense category "${before.name}" to "${clean}"`,
    previous: { name: before.name },
    next: { name: clean },
  });
  revalidatePath("/expenses");
}

export async function setExpenseCategoryActive(id: string, isActive: boolean) {
  const access = await assertPermission("settings.system");
  const cat = await prisma.expenseCategory.update({ where: { id }, data: { isActive } });
  await logAudit({
    actor: access,
    action: isActive ? "activated" : "deactivated",
    title: isActive ? "Reactivated Expense Category" : "Deactivated Expense Category",
    module: "Expenses",
    entityType: "ExpenseCategory",
    entityId: id,
    description: `${isActive ? "Reactivated" : "Deactivated"} expense category "${cat.name}"`,
  });
  revalidatePath("/expenses");
}

export async function getBackupInfo() {
  await assertOwner();
  const [products, variants, sales, customers, expenses, users] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.sale.count(),
    prisma.customer.count(),
    prisma.expense.count(),
    prisma.user.count(),
  ]);
  return { products, variants, sales, customers, expenses, users };
}
