"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunCheckButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/check", { method: "POST" });
      const r = await res.json();
      setMsg(`Check ${r.status}: ${r.alertsCreated} new alert(s), ${r.alertsResolved} resolved`);
    } catch {
      setMsg("Check failed. See Run history.");
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={run} disabled={busy}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-brand disabled:opacity-60">
        {busy ? "Checking..." : "Run check now"}
      </button>
      {msg && <span role="status" className="text-sm">{msg}</span>}
    </div>
  );
}
