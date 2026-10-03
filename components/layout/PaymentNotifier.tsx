"use client";

import { useEffect, useRef, useState } from "react";
import { GATEWAYS, isGateway } from "@/lib/online-pay";

type Incoming = { id: string; gateway: string; amount: number; paidAt: number; reference: string; mine: boolean };

const rs = (n: number) => `Rs.${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.start(t);
      osc.stop(t + 0.3);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    /* browsers may block sound until the page has been clicked once */
  }
}

/** Pops up on every screen the moment a customer confirms an online payment. */
export function PaymentNotifier() {
  const [toasts, setToasts] = useState<Incoming[]>([]);
  const since = useRef(Date.now());
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/notifications/payments?since=${since.current}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { payments: Incoming[] };
        const fresh = data.payments.filter((p) => !seen.current.has(p.id));
        if (stopped || fresh.length === 0) return;
        fresh.forEach((p) => {
          seen.current.add(p.id);
          since.current = Math.max(since.current, p.paidAt);
        });
        setToasts((prev) => [...prev, ...fresh]);
        chime();
        fresh.forEach((p) => setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== p.id)), 10000));
      } catch {
        /* offline: try again on the next tick */
      }
    };
    const timer = setInterval(poll, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 top-14 z-[70] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:top-16 lg:top-4">
      {toasts.map((t) => {
        const brand = isGateway(t.gateway) ? GATEWAYS[t.gateway] : { label: t.gateway, color: "#16a34a", soft: "#ecfdf5" };
        return (
          <button
            key={t.id}
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-xl sm:w-80"
            style={{ borderColor: brand.color }}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: brand.soft }}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke={brand.color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-sm font-bold text-zinc-900">Payment received</span>
              <span className="block text-sm text-zinc-700">
                {rs(t.amount)} paid via {brand.label}
              </span>
              <span className="block text-[11px] text-zinc-400">Ref {t.reference}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
