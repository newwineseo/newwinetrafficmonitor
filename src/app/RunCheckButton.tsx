"use client";

import { useState } from "react";

export function RunCheckButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/check", { method: "POST" });
    const r = await res.json().catch(() => null);
    setBusy(false);
    setMsg(r ? `Run ${r.status}: ${r.alertsCreated} new alert(s), ${r.alertsResolved} resolved` : "Run failed");
    setTimeout(() => window.location.reload(), 1500);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={run} disabled={busy} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Checking..." : "Run check now"}
      </button>
      {msg && <span className="text-sm">{msg}</span>}
    </div>
  );
}
