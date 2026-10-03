"use client";

import { createContext, useContext, useEffect } from "react";
import { applyBrand } from "@/lib/shop-info";
import type { SettingsValues } from "@/lib/settings-schema";

type AccessInfo = { isOwner: boolean; permissions: string[] };

const SettingsContext = createContext<SettingsValues | null>(null);
const AccessContext = createContext<AccessInfo>({ isOwner: false, permissions: [] });

export function SettingsProvider({
  settings,
  access,
  children,
}: {
  settings: SettingsValues;
  access: AccessInfo;
  children: React.ReactNode;
}) {
  // PDFs are built in the browser, so they need the saved shop details too.
  applyBrand(settings);
  const theme = settings.system.theme === "dark" ? "dark" : "light";
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);
  return (
    <SettingsContext.Provider value={settings}>
      <AccessContext.Provider value={access}>{children}</AccessContext.Provider>
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsValues {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

/** Whether the signed-in person holds a permission (the Owner holds all). The server still enforces it. */
export function useCan(): (permission: string) => boolean {
  const { isOwner, permissions } = useContext(AccessContext);
  return (permission) => isOwner || permissions.includes(permission);
}
