"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  currentSubscription, disablePushOnThisDevice, enablePushOnThisDevice, needsHomeScreenInstall,
  pushSupported, readPref, writePref,
} from "@/lib/client";
import { btn } from "./ui";

type State = "loading" | "unsupported" | "install-first" | "off" | "on" | "blocked";

function useDeviceState() {
  const [state, setState] = useState<State>("loading");
  const refresh = async () => {
    if (needsHomeScreenInstall()) return setState("install-first");
    if (!pushSupported()) return setState("unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    const sub = await currentSubscription().catch(() => null);
    setState(sub && Notification.permission === "granted" ? "on" : "off");
  };
  useEffect(() => { refresh(); }, []);
  return { state, refresh };
}

export function IosInstructions() {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
      <p className="font-semibold">Add to Home Screen first</p>
      <p className="mt-1">On iPhone and iPad, alerts only work from the installed app (iOS 16.4 or later):</p>
      <ol className="mt-1 list-decimal pl-5">
        <li>In Safari, tap the Share button.</li>
        <li>Choose Add to Home Screen, then Add.</li>
        <li>Open NW Monitor from the new Home Screen icon and sign in.</li>
        <li>Come back here and tap Enable alerts on this device.</li>
      </ol>
    </div>
  );
}

/** "Enable alerts on this device" button with its status. Used in Settings. */
export function EnableAlertsButton() {
  const router = useRouter();
  const { state, refresh } = useDeviceState();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(fn: () => Promise<void>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setBusy(false);
    await refresh();
    router.refresh();
  }

  if (state === "loading") return <p className="text-sm text-gray-600">Checking this device...</p>;
  if (state === "install-first") return <IosInstructions />;
  if (state === "unsupported") return <p className="text-sm">This browser does not support push notifications. Use Chrome on Android, or the installed app on iPhone.</p>;

  return (
    <div className="space-y-2">
      {state === "blocked" && (
        <p className="text-sm text-critical">Error: notifications are blocked for this site. Allow them in the browser&apos;s site settings, then reload.</p>
      )}
      {state === "on" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-ok">Alerts are on for this device.</span>
          <button className={btn.secondary} disabled={busy} onClick={() => run(disablePushOnThisDevice, "Alerts turned off for this device.")}>
            Turn off on this device
          </button>
        </div>
      ) : (
        <button className={btn.primary} disabled={busy || state === "blocked"}
          onClick={() => run(enablePushOnThisDevice, "Alerts enabled. Use Send test notification to check.")}>
          {busy ? "Enabling..." : "Enable alerts on this device"}
        </button>
      )}
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-ok" : "text-critical"}`}>{msg.ok ? "" : "Error: "}{msg.text}</p>}
    </div>
  );
}

const BANNER_DISMISSED = "nw-enable-banner-dismissed";

/** Dismissible banner shown at the top of the app until alerts are enabled on this device. */
export function EnableAlertsBanner() {
  const { state } = useDeviceState();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => { setDismissed(readPref(BANNER_DISMISSED) === "1"); }, []);

  if (dismissed || !["off", "install-first"].includes(state)) return null;
  return (
    <div className="border-b border-accent/30 bg-blue-50">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {state === "install-first" ? <IosInstructions /> : (
              <>
                <p className="mb-2 text-sm">Get a notification on this device when traffic drops.</p>
                <EnableAlertsButton />
              </>
            )}
          </div>
          <button className="shrink-0 text-sm text-brand underline" onClick={() => { writePref(BANNER_DISMISSED, "1"); setDismissed(true); }}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
