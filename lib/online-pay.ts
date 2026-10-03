export type GatewayId = "KHALTI" | "ESEWA" | "FONEPAY";

export const GATEWAYS: Record<GatewayId, { label: string; color: string; soft: string; settingKey: string }> = {
  KHALTI: { label: "Khalti", color: "#5C2D91", soft: "#F1EAF9", settingKey: "khalti" },
  ESEWA: { label: "eSewa", color: "#41A124", soft: "#E8F5E3", settingKey: "esewa" },
  FONEPAY: { label: "Fonepay", color: "#D7263D", soft: "#FCE9EB", settingKey: "fonepay" },
};

export const GATEWAY_IDS = Object.keys(GATEWAYS) as GatewayId[];

export const isGateway = (v: string): v is GatewayId => v in GATEWAYS;

export const PAYMENT_WINDOW_MS = 10 * 60 * 1000;

export type PayStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";
