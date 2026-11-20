"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { readPref, registerServiceWorker, soundEnabled, writePref } from "@/lib/client";

interface Summary {
  open: number;
  critical: number;
  latestId: number;
  latest: { id: number; siteName: string; severity: "warning" | "critical"; text: string } | null;
}

const POLL_MS = 60_000;
const LAST_SEEN = "nw-last-alert-id";

/** Plays the alert sound (when unlocked by a tap and turned on in Settings). Shared with the Settings test button. */
let audio: HTMLAudioElement | null = null;
export function getAlertAudio(): HTMLAudioElement {
  audio ??= new Audio("/alert.mp3");
  return audio;
}

/**
 * Runs on every page while the app is open: polls for new alerts every 60 seconds,
 * plays the alarm, shows a red pop-up and keeps the app badge in sync with the open count.
 */
export function AlertWatcher() {
  const router = useRouter();
  const [toast, setToast] = useState<Summary["latest"] & { count: number } | null>(null);
  const lastSeen = useRef<number | null>(null);

  // Browsers block sound until the user interacts with the page: unlock on the first tap anywhere.
  useEffect(() => {
    const unlock = () => {
      const a = getAlertAudio();
      a.muted = true;
      a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    registerServiceWorker().catch(() => {});
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const poll = useCallback(async () => {
    let s: Summary;
    try {
      const res = await fetch("/api/alerts/summary", { cache: "no-store" });
      if (!res.ok) return;
      s = await res.json();
    } catch {
      return; // offline: try again next time
    }

    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (s.open > 0) nav.setAppBadge?.(s.open).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});

    if (lastSeen.current === null) {
      const stored = Number(readPref(LAST_SEEN));
      lastSeen.current = Number.isFinite(stored) && stored > 0 ? stored : s.latestId; // first visit: no alarm for old alerts
    }
    if (s.latest && s.latest.id > lastSeen.current) {
      if (soundEnabled()) getAlertAudio().play().catch(() => {});
      setToast({ ...s.latest, count: s.open });
      router.refresh();
    }
    lastSeen.current = Math.max(lastSeen.current, s.latestId);
    writePref(LAST_SEEN, String(lastSeen.current));
  }, [router]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [poll]);

  if (!toast) return null;
  return (
    <div role="alert" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-lg bg-critical p-4 text-white shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">New {toast.severity === "critical" ? "critical" : "warning"} alert: {toast.siteName}</div>
          <div className="mt-0.5 text-sm">{toast.text}</div>
          <Link href="/alerts" onClick={() => setToast(null)} className="mt-2 inline-block text-sm font-semibold underline">
            View {toast.count} open alert{toast.count === 1 ? "" : "s"}
          </Link>
        </div>
        <button onClick={() => setToast(null)} className="shrink-0 rounded px-2 py-1 text-sm font-semibold hover:bg-white/15" aria-label="Dismiss">
          Close
        </button>
      </div>
    </div>
  );
}
