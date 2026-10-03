"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/date-utils";
import { GATEWAYS, isGateway } from "@/lib/online-pay";
import {
  applyOnlinePayment,
  cancelPaymentRequest,
  createPaymentRequest,
  getOnlineGateways,
  type OnlineGateway,
} from "@/app/(dashboard)/sales/online-payment-actions";

type Step = "idle" | "choose" | "qr" | "paid" | "failed";

/**
 * Collects the unpaid part of an invoice by QR, inside the invoice screen. When the customer
 * confirms on their phone, the payment is recorded on the sale and the invoice updates.
 */
export function OnlinePayPanel({
  saleId,
  amount,
  autoStart = false,
  onWaitingChange,
  onPaid,
}: {
  saleId: string;
  amount: number;
  autoStart?: boolean;
  onWaitingChange?: (waiting: boolean) => void;
  onPaid: (result: { gateway: string; applied: number }) => void;
}) {
  const [step, setStep] = useState<Step>(autoStart ? "choose" : "idle");
  const [gateways, setGateways] = useState<OnlineGateway[] | null>(null);
  const [gateway, setGateway] = useState("");
  const [request, setRequest] = useState<{ id: string; token: string; url: string; local: boolean; expiresAt: string } | null>(null);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(0);
  const finished = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const onWaitingRef = useRef(onWaitingChange);
  onWaitingRef.current = onWaitingChange;

  // Tell the invoice screen when a QR is on screen, so it can hold back "send" and "new sale".
  useEffect(() => {
    onWaitingRef.current?.(step === "choose" || step === "qr");
  }, [step]);

  useEffect(() => {
    if (step !== "choose" || gateways !== null) return;
    getOnlineGateways()
      .then(setGateways)
      .catch((e) => {
        setGateways([]);
        setError(e instanceof Error ? e.message : "Could not load payment options");
      });
  }, [step, gateways]);

  const choose = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const req = await createPaymentRequest(id, amount, saleId);
      setGateway(id);
      setRequest(req);
      setQr(await QRCode.toDataURL(req.url, { width: 360, margin: 1, errorCorrectionLevel: "M" }));
      finished.current = false;
      setStep("qr");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the QR code");
    } finally {
      setBusy(false);
    }
  };

  // Watch for the customer's confirmation every second and a half.
  useEffect(() => {
    if (step !== "qr" || !request) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/pay/${request.token}`, { cache: "no-store" });
        const data = await res.json();
        if (finished.current) return;
        if (data.status === "PAID") {
          finished.current = true;
          try {
            const result = await applyOnlinePayment(saleId, request.id);
            setApplied(result.applied);
            setStep("paid");
            onPaidRef.current({ gateway, applied: result.applied });
          } catch (e) {
            setError(e instanceof Error ? e.message : "The payment arrived but could not be recorded");
            setStep("failed");
          }
        } else if (data.status === "EXPIRED" || data.status === "CANCELLED") {
          finished.current = true;
          setError(data.status === "EXPIRED" ? "The QR code expired." : "The payment was cancelled.");
          setStep("failed");
        }
      } catch {
        /* network blip: try again on the next tick */
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [step, request, saleId, gateway]);

  useEffect(() => {
    if (step !== "qr" || !request) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((new Date(request.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [step, request]);

  const cancel = async () => {
    if (request && step === "qr") {
      try {
        await cancelPaymentRequest(request.id);
      } catch {
        /* it will simply expire */
      }
    }
    setRequest(null);
    setStep("idle");
  };

  const brand = gateway && isGateway(gateway) ? GATEWAYS[gateway] : null;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (step === "paid" && brand) {
    return (
      <div className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: brand.color, background: brand.soft }}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke={brand.color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <div className="leading-tight">
          <div className="text-sm font-bold text-zinc-900">Payment Successful</div>
          <div className="text-xs text-zinc-700">
            NPR {formatCurrency(applied)} received via {brand.label}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">Payment due</div>
          <div className="text-lg font-bold text-text">NPR {formatCurrency(amount)}</div>
        </div>
        {step === "idle" && <Button onClick={() => setStep("choose")}>Collect online (QR)</Button>}
      </div>

      {step === "choose" && (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium text-text">Choose the customer&apos;s payment gateway</p>
          {gateways === null ? (
            <p className="py-2 text-center text-sm text-text-muted">Loading...</p>
          ) : gateways.length === 0 ? (
            <p className="text-sm text-text-muted">{error || "No online gateway is available. Turn on QR payments and a gateway in Settings → Payments."}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {gateways.map((g) => {
                const b = isGateway(g.id) ? GATEWAYS[g.id] : null;
                return (
                  <button
                    key={g.id}
                    disabled={busy}
                    onClick={() => choose(g.id)}
                    className="rounded-xl border px-2 py-3 text-sm font-bold transition active:scale-[0.98] disabled:opacity-60"
                    style={{ borderColor: b?.color, background: b?.soft, color: b?.color }}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          )}
          {error && gateways && gateways.length > 0 && <p className="text-sm text-danger">{error}</p>}
          <Button variant="ghost" className="w-full" onClick={() => setStep("idle")}>
            Cancel
          </Button>
        </div>
      )}

      {step === "qr" && request && brand && (
        <div className="mt-3 space-y-2">
          <div className="rounded-2xl p-3 text-center" style={{ background: brand.soft }}>
            <div className="mb-2 text-sm font-bold" style={{ color: brand.color }}>
              Scan with {brand.label}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Payment QR code" className="mx-auto h-48 w-48 rounded-xl bg-white p-2" />
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-zinc-700">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
              </span>
              Waiting for the customer to pay... {mm}:{ss}
            </div>
          </div>
          {request.local && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
              The customer&apos;s phone must be on the <b>same Wi-Fi</b> as this computer. (On the live website this works from anywhere.)
            </p>
          )}
          <p className="break-all text-center text-[11px] text-text-muted">{request.url}</p>
          <a href={request.url} target="_blank" rel="noreferrer" className="block text-center text-xs font-medium text-accent hover:underline">
            Open the payment page on this device instead
          </a>
          <Button variant="ghost" className="w-full" onClick={cancel}>
            Cancel QR
          </Button>
        </div>
      )}

      {step === "failed" && (
        <div className="mt-3 space-y-2">
          <p className="text-center text-sm text-danger">{error}</p>
          <Button
            className="w-full"
            onClick={() => {
              setError("");
              setStep("choose");
            }}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
