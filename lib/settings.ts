import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { applyBrand } from "@/lib/shop-info";
import { buildSettings, type SettingsValues } from "@/lib/settings-schema";

/** Current settings: saved values merged over the defaults. Cached for the length of one request. */
export const getSettings = cache(async (): Promise<SettingsValues> => {
  const row = await prisma.systemSettings.findFirst({ select: { data: true } });
  const settings = buildSettings(row?.data);
  applyBrand(settings);
  return settings;
});

export async function saveSettingsData(data: unknown) {
  const row = await prisma.systemSettings.findFirst({ select: { id: true } });
  if (row) {
    await prisma.systemSettings.update({ where: { id: row.id }, data: { data: data as object } });
  } else {
    await prisma.systemSettings.create({ data: { shopName: "Labash Fashion", data: data as object } });
  }
}

/** Raw stored JSON (without defaults), so we only persist what the Owner actually changed. */
export async function getStoredSettings(): Promise<Record<string, Record<string, unknown>>> {
  const row = await prisma.systemSettings.findFirst({ select: { data: true } });
  return (row?.data && typeof row.data === "object" ? row.data : {}) as Record<string, Record<string, unknown>>;
}

/** Next number for a counter like invoices or purchases: prefix + padded number. */
export function nextNumber(
  lastNumber: number,
  startingNumber: number
): number {
  return Math.max(lastNumber + 1, startingNumber);
}
