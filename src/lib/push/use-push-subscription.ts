import { useCallback, useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription } from "./persist";

export type PushStatus = "unsupported" | "unsubscribed" | "subscribed" | "denied";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Registers /sw.js on mount (harmless no-op if already registered) and
 * reports/manages this browser's push subscription. Use in Settings — the
 * subscribe/unsubscribe actions must stay behind an explicit user action
 * (a button), since browsers require a user gesture before granting the
 * Notification permission prompt.
 */
export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>("unsubscribed");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    void navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (Notification.permission === "denied") setStatus("denied");
      else setStatus(existing ? "subscribed" : "unsubscribed");
    });
  }, []);

  const enable = useCallback(async () => {
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidKey) {
      setStatus("unsupported");
      return;
    }
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
      if (json.endpoint && json.keys) {
        await savePushSubscription({ data: { endpoint: json.endpoint, keys: json.keys } });
        setStatus("subscribed");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setStatus("unsubscribed");
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, enable, disable };
}
