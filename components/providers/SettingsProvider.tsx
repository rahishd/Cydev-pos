"use client";

import { createContext, useContext } from "react";
import { applyBrand } from "@/lib/shop-info";
import type { SettingsValues } from "@/lib/settings-schema";

const SettingsContext = createContext<SettingsValues | null>(null);

export function SettingsProvider({
  settings,
  children,
}: {
  settings: SettingsValues;
  children: React.ReactNode;
}) {
  // PDFs are built in the browser, so they need the saved shop details too.
  applyBrand(settings);
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValues {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
