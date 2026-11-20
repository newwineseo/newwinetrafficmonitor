// Deterministic synthetic data for DEMO_MODE. Any property string starting with "demo:" uses this.
import type { Metric } from "@/db/schema";
import { addDays, dateRange, todayInTz } from "./dates";

export interface DemoSiteDef {
  key: string;
  name: string;
  domain: string;
  /** Typical weekday level per metric. */
  levels: Record<Metric, number>;
}

export const DEMO_SITES: DemoSiteDef[] = [
  { key: "steady", name: "Demo: Steady Site", domain: "steady.example.com",
    levels: { gsc_clicks: 320, gsc_impressions: 9800, ga4_sessions: 540, ga4_organic: 310 } },
  { key: "gsc-drop", name: "Demo: GSC Drop", domain: "gscdrop.example.com",
    levels: { gsc_clicks: 260, gsc_impressions: 7200, ga4_sessions: 410, ga4_organic: 230 } },
  { key: "tracking-break", name: "Demo: Tracking Break", domain: "trackingbreak.example.com",
    levels: { gsc_clicks: 180, gsc_impressions: 5100, ga4_sessions: 225, ga4_organic: 140 } },
  { key: "small", name: "Demo: Small Site", domain: "small.example.com",
    levels: { gsc_clicks: 4, gsc_impressions: 16, ga4_sessions: 14, ga4_organic: 6 } },
];

const DEMO_TZ = "Asia/Kolkata";
export const isDemoProperty = (p: string | null | undefined) => !!p && p.startsWith("demo:");
const keyOf = (property: string) => property.slice("demo:".length);

/** Stable pseudo-random number in [-1, 1] for a given string. */
function noise(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/** Mild weekly shape: weekends are a little lower. */
function weekdayFactor(date: string): number {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return dow === 6 ? 0.88 : dow === 0 ? 0.85 : 1;
}

/** Last day GSC "has" in demo mode: 2 days ago, like the real API. */
export const demoGscNewest = (now = new Date()) => addDays(todayInTz(DEMO_TZ, now), -2);
/** Last day GA4 has in demo mode: yesterday. */
export const demoGa4Newest = (now = new Date()) => addDays(todayInTz(DEMO_TZ, now), -1);

function demoValue(key: string, metric: Metric, date: string, now: Date): number | undefined {
  const site = DEMO_SITES.find((s) => s.key === key);
  if (!site) return undefined;
  let v = site.levels[metric] * weekdayFactor(date) * (1 + 0.04 * noise(`${key}|${metric}|${date}`));

  if (key === "gsc-drop" && metric === "gsc_clicks" && date > addDays(demoGscNewest(now), -2)) {
    // About a 48% drop against the 7-day average on the newest day: a warning.
    // No weekend dip and less noise here, so the drop stays between 1x and 2x the threshold.
    v = site.levels[metric] * 0.48 * (1 + 0.02 * noise(`${key}|drop|${date}`));
  }
  if (key === "tracking-break" && metric.startsWith("ga4_") && date === demoGa4Newest(now)) {
    return undefined; // GA4 returns no rows at all; zero-filling turns this into 0: critical
  }
  return Math.max(0, Math.round(v));
}

export interface GscRow { date: string; clicks: number; impressions: number }
export interface Ga4Row { date: string; sessions: number; organic: number }

export function demoGsc(property: string, start: string, end: string, now = new Date()): GscRow[] {
  const last = demoGscNewest(now);
  const key = keyOf(property);
  if (!DEMO_SITES.some((s) => s.key === key)) throw new Error(`User does not have access to ${property}`);
  return dateRange(start, end < last ? end : last).map((date) => ({
    date,
    clicks: demoValue(key, "gsc_clicks", date, now)!,
    impressions: demoValue(key, "gsc_impressions", date, now)!,
  }));
}

export function demoGa4(property: string, start: string, end: string, now = new Date()): Ga4Row[] {
  const last = demoGa4Newest(now);
  const key = keyOf(property);
  if (!DEMO_SITES.some((s) => s.key === key)) throw new Error(`No access to GA4 ${property}`);
  const rows: Ga4Row[] = [];
  for (const date of dateRange(start, end < last ? end : last)) {
    const sessions = demoValue(key, "ga4_sessions", date, now);
    const organic = demoValue(key, "ga4_organic", date, now);
    if (sessions === undefined || organic === undefined) continue; // GA4 omits empty days
    rows.push({ date, sessions, organic });
  }
  return rows;
}
