import type { Metric } from "@/db/schema";

/** Times are shown in India time, where the team works. */
export const DISPLAY_TZ = "Asia/Kolkata";

export const METRIC_LABEL: Record<Metric, string> = {
  gsc_clicks: "GSC clicks",
  gsc_impressions: "GSC impressions",
  ga4_sessions: "GA4 sessions",
  ga4_organic: "GA4 organic sessions",
};

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Math.round(n).toLocaleString("en-IN");
}

/** "+4.1%" / "-45.6%" */
export function fmtChange(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "-";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d) + " IST";
}

/** "19 Nov" from "2026-11-19" */
export function fmtDay(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" })
    .format(new Date(`${date}T00:00:00Z`));
}

export function fmtAgo(d: Date | null | undefined, now = new Date()): string {
  if (!d) return "never";
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

/** Headline for an alert, e.g. "GA4 sessions down 100% (0 vs avg 225)". */
export function alertLine(a: { metric: Metric; value: number; baseline: number; dropPct: number }): string {
  return `${METRIC_LABEL[a.metric]} down ${Math.round(a.dropPct)}% (${fmtNum(a.value)} vs avg ${fmtNum(a.baseline)})`;
}
