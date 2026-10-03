"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GATEWAYS, isGateway } from "@/lib/online-pay";

type Info = {
  status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";
  gateway: string;
  amount: number;
  shopName: string;
  reference: string;
};

const rs = (n: number) => `Rs.${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function PayPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/pay/${token}`, { cache: "no-store" });
    if (res.status === 404) {
      setMissing(true);
      return;
    }
    setInfo(await res.json());
  }, [token]);

  useEffect(() => {
    load().catch(() => setMissing(true));
  }, [load]);

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/pay/${token}`, { method: "POST" });
      const data = await res.json();
      setInfo((prev) => (prev ? { ...prev, status: data.status } : prev));
    } finally {
      setBusy(false);
    }
  };

  const brand = info && isGateway(info.gateway) ? GATEWAYS[info.gateway] : { label: "Payment", color: "#334155", soft: "#F1F5F9" };

  if (missing) {
    return (
      <Shell color="#334155" title="Payment">
        <p className="py-10 text-center text-sm text-zinc-600">This payment link is not valid.</p>
      </Shell>
    );
  }
  if (!info) {
    return (
      <Shell color="#334155" title="Payment">
        <p className="py-10 text-center text-sm text-zinc-500">Loading...</p>
      </Shell>
    );
  }

  return (
    <Shell color={brand.color} title={brand.label}>
      {info.status === "PAID" ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background: brand.soft }}>
            <svg viewBox="0 0 24 24" className="h-14 w-14" fill="none" stroke={brand.color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <h2 className="mt-5 text-xl font-bold text-zinc-900">Payment Successful</h2>
          <p className="mt-2 text-base text-zinc-700">{rs(info.amount)} has been successfully paid.</p>
          <p className="mt-1 text-sm text-zinc-500">to {info.shopName}</p>
          <p className="mt-6 text-xs text-zinc-400">Ref {info.reference} · You can close this page.</p>
        </div>
      ) : info.status === "PENDING" ? (
        <div className="py-4">
          <div className="rounded-2xl p-5 text-center" style={{ background: brand.soft }}>
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Paying</div>
            <div className="mt-1 text-lg font-semibold text-zinc-900">{info.shopName}</div>
            <div className="mt-4 text-4xl font-extrabold" style={{ color: brand.color }}>
              {rs(info.amount)}
            </div>
            <div className="mt-3 text-xs text-zinc-500">Ref {info.reference}</div>
          </div>
          <button
            onClick={confirm}
            disabled={busy}
            className="mt-6 w-full rounded-2xl py-4 text-base font-bold text-white shadow-lg active:scale-[0.98] disabled:opacity-60"
            style={{ background: brand.color }}
          >
            {busy ? "Processing..." : "Confirm Payment"}
          </button>
          <p className="mt-4 text-center text-xs text-zinc-400">Demo payment page. No real money is charged.</p>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-zinc-600">
          {info.status === "EXPIRED" ? "This payment request has expired." : "This payment request was cancelled."}
          <br />
          Please ask the shop for a new QR code.
        </p>
      )}
    </Shell>
  );
}

function Shell({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <div className="px-5 pb-16 pt-6 text-white" style={{ background: color }}>
        <div className="mx-auto flex max-w-sm items-center justify-between">
          <span className="text-xl font-extrabold tracking-tight">{title}</span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider">Demo</span>
        </div>
      </div>
      <div className="mx-auto -mt-10 max-w-sm px-4 pb-10">
        <div className="rounded-3xl bg-white p-5 shadow-xl">{children}</div>
      </div>
    </div>
  );
}
