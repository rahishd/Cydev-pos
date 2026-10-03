import { SHOP_LOGO_DATA_URL } from "@/lib/shop-logo";
import type { SettingsValues } from "@/lib/settings-schema";

export type ShopBrand = {
  name: string;
  addressLines: string[];
  phone: string;
  email: string;
  panVat: string;
  registrationNo: string;
  footer: string;
  returnPolicy: string;
  terms: string;
  logo: string | null;
  showLogo: boolean;
  showPanVat: boolean;
};

// Starts with the shop's original details and is replaced by the saved Settings (see applyBrand).
export const SHOP_INFO: ShopBrand = {
  name: "Labash Fashion",
  addressLines: ["Manigram, Sattar Line, Tilottama-5", "Tilottama Municipality"],
  phone: "97609450",
  email: "labashfashion@gmail.com",
  panVat: "",
  registrationNo: "",
  footer: "Thank you for shopping with us!",
  returnPolicy: "",
  terms: "",
  logo: null,
  showLogo: true,
  showPanVat: true,
};

export function applyBrand(s: SettingsValues) {
  const b = s.business;
  const inv = s.invoice;
  SHOP_INFO.name = String(b.shopName || "");
  SHOP_INFO.addressLines = [b.addressLine1, b.addressLine2].map(String).filter(Boolean);
  SHOP_INFO.phone = String(b.phone || "");
  SHOP_INFO.email = String(b.email || "");
  SHOP_INFO.panVat = String(b.panVat || "");
  SHOP_INFO.registrationNo = String(b.registrationNo || "");
  SHOP_INFO.logo = typeof b.logo === "string" && b.logo ? b.logo : null;
  SHOP_INFO.footer = String(inv.footer || "");
  SHOP_INFO.returnPolicy = String(inv.returnPolicy || "");
  SHOP_INFO.terms = String(inv.terms || "");
  SHOP_INFO.showLogo = Boolean(inv.showLogo);
  SHOP_INFO.showPanVat = Boolean(inv.showPanVat);
}

/** The logo to print on PDFs, or null when the shop has hidden it. */
export function shopLogo(): { data: string; format: "PNG" | "JPEG" } | null {
  if (!SHOP_INFO.showLogo) return null;
  const data = SHOP_INFO.logo ?? SHOP_LOGO_DATA_URL;
  return { data, format: data.startsWith("data:image/png") ? "PNG" : "JPEG" };
}

export function contactLine(): string {
  return [SHOP_INFO.name, SHOP_INFO.phone, SHOP_INFO.email].filter(Boolean).join("  |  ");
}
