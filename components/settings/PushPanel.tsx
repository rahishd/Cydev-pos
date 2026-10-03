"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  getPushStatus,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/app/(dashboard)/settings/push-actions";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=").replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Env = {
  supported: boolean;
  secure: boolean;
  iosNeedsInstall: boolean;
  permission: NotificationPermission | "unsupported";
};

function readEnv(): Env {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return {
    supported,
    secure: window.isSecureContext,
    iosNeedsInstall: ios && !standalone,
    permission: "Notification" in window ? Notification.permission : "unsupported",
  };
}

export function PushPanel() {
  const [env, setEnv] = useState<Env | null>(null);
  const [server, setServer] = useState<{ configured: boolean; devices: number } | null>(null);
  const [thisDevice, setThisDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const e = readEnv();
    setEnv(e);
    try {
      setServer(await getPushStatus());
    } catch {
      setServer(null);
    }
    if (e.supported) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setThisDevice(Boolean(sub));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (!PUBLIC_KEY) throw new Error("Push notifications aren't configured on this site yet.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notifications are blocked. Allow them for this site in your browser settings, then try again.");
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(PUBLIC_KEY) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await savePushSubscription(json, navigator.userAgent);
      setMsg({ ok: true, text: "Notifications are on for this phone." });
      await refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not turn on notifications" });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setMsg({ ok: true, text: "Notifications are off for this phone." });
      await refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not turn off notifications" });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await sendTestPush();
      setMsg(
        r.sent > 0
          ? { ok: true, text: `Sent to ${r.sent} device${r.sent === 1 ? "" : "s"}. It should pop up in a few seconds, even if the phone is locked.` }
          : { ok: false, text: "Nothing was delivered. Turn notifications on for a device first." }
      );
      await refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not send the test" });
    } finally {
      setBusy(false);
    }
  };

  if (!env) return null;

  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-1 text-sm font-semibold text-text">Phone notifications (Owner)</div>
      <p className="mb-3 text-xs text-text-muted">
        Get a notification on this phone, even when it&apos;s locked, whenever staff make a sale, take a payment, process a
        return or change stock. Choose what to be told about with the switches below.
      </p>

      {!env.secure ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Phone notifications need the secure website address (https), such as your live Vercel site. They can&apos;t be
          turned on from a local Wi-Fi address.
        </p>
      ) : env.iosNeedsInstall ? (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <b>On iPhone:</b> tap the Share button in Safari, choose <b>Add to Home Screen</b>, then open Labash from your Home
          Screen and come back to this page to turn notifications on.
        </div>
      ) : !env.supported ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This browser can&apos;t receive background notifications. Try Chrome on Android, or Safari on iPhone after adding
          the app to your Home Screen.
        </p>
      ) : server && !server.configured ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Notifications aren&apos;t set up on the server yet (missing push keys).
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${thisDevice ? "bg-green-500" : "bg-zinc-300"}`} />
            <span className="text-text">{thisDevice ? "On for this phone" : "Off for this phone"}</span>
            {server && <span className="text-xs text-text-muted">· {server.devices} device{server.devices === 1 ? "" : "s"} total</span>}
          </div>
          {env.permission === "denied" && (
            <p className="text-xs text-danger">
              Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {thisDevice ? (
              <Button variant="ghost" onClick={disable} disabled={busy}>
                Turn off on this phone
              </Button>
            ) : (
              <Button onClick={enable} disabled={busy}>
                {busy ? "Working..." : "Turn on for this phone"}
              </Button>
            )}
            <Button variant="secondary" onClick={test} disabled={busy || !server || server.devices === 0}>
              Send a test notification
            </Button>
          </div>
        </div>
      )}

      {msg && <p className={`mt-3 text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
