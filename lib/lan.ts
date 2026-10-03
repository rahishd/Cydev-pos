import os from "os";

/**
 * This computer's address on the local Wi-Fi/LAN (for example 192.168.1.20), so a phone on the same
 * network can open pages from a locally running app. "localhost" only ever means the phone itself.
 */
export function lanAddress(): string | null {
  const virtualName = /virtual|vbox|vmware|vethernet|hyper-v|wsl|docker|loopback|bluetooth|tailscale|zerotier/i;
  const found: { ip: string; score: number }[] = [];

  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== "IPv4" || a.internal) continue;
      const ip = a.address;
      if (/^169\.254\./.test(ip)) continue;

      let score = 0;
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) score += 2;
      if (/^192\.168\.(56|137)\./.test(ip)) score -= 3; // VirtualBox host-only network, Windows hotspot
      if (virtualName.test(name)) score -= 3;
      if (/^(wi-?fi|wlan\d*|wireless|ethernet|en0|eth0)$/i.test(name.trim())) score += 2;
      found.push({ ip, score });
    }
  }

  return found.sort((x, y) => y.score - x.score)[0]?.ip ?? null;
}

export function allLanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) if (a.family === "IPv4" && !a.internal) out.push(a.address);
  }
  return out;
}
