"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAlertAudio } from "@/components/AlertWatcher";
import { EnableAlertsButton } from "@/components/EnableAlerts";
import { btn, Card } from "@/components/ui";
import { SOUND_PREF, soundEnabled, writePref } from "@/lib/client";

export function DeviceSettings() {
  const [sound, setSound] = useState(true);
  useEffect(() => setSound(soundEnabled()), []);

  return (
    <Card className="space-y-5">
      <h2 className="font-semibold text-brand">Alerts on this device</h2>
      <EnableAlertsButton />

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={sound} onChange={(e) => {
            setSound(e.target.checked);
            writePref(SOUND_PREF, e.target.checked ? "on" : "off");
          }} />
          Play an alarm sound when a new alert arrives while the app is open
        </label>
        <button className={btn.secondary} onClick={() => { const a = getAlertAudio(); a.currentTime = 0; a.play().catch(() => {}); }}>
          Play test sound
        </button>
        <p className="text-xs text-gray-500">
          With the app closed, the phone plays its normal notification sound. The alarm sound only plays while the app is open.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <TestButton url="/api/test/email" label="Send test email" />
        <TestButton url="/api/test/push" label="Send test notification" />
      </div>
    </Card>
  );
}

function TestButton({ url, label }: { url: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      setMsg({ ok: res.ok, text: body.message ?? body.error ?? `Request failed (${res.status})` });
    } catch {
      setMsg({ ok: false, text: "Request failed. Check your connection." });
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="w-full sm:w-auto">
      <button className={btn.secondary} disabled={busy} onClick={run}>{busy ? "Sending..." : label}</button>
      {msg && <p role="status" className={`mt-1 text-sm ${msg.ok ? "text-ok" : "text-critical"}`}>{msg.ok ? "" : "Error: "}{msg.text}</p>}
    </div>
  );
}
