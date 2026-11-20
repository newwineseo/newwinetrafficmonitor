import type { Metric, Severity } from "@/db/schema";
import { addDays, dateRange } from "./dates";

export const DEFAULT_THRESHOLD = 25;
export const DEFAULT_MIN_BASELINE = 20;
export const BASELINE_DAYS = 7;
export const MIN_BASELINE_DAYS = 5;
export const GSC_STALE_DAYS = 6;

/** date -> value. A missing date means "no data" for that day. */
export type Series = Map<string, number>;

export type EvalStatus = "ok" | "warning" | "critical" | "low-volume" | "insufficient-data" | "no-data";

export interface Evaluation {
  metric: Metric;
  date: string;
  status: EvalStatus;
  value: number | null;
  baseline: number | null;
  dropPct: number | null;
  thresholdPct: number;
}

export interface EvalOptions {
  thresholdPct?: number | null;
  minBaseline?: number | null;
}

/** Evaluate one metric on one day against the average of the 7 days before it. */
export function evaluateMetric(metric: Metric, series: Series, date: string, opts: EvalOptions = {}): Evaluation {
  const thresholdPct = opts.thresholdPct ?? DEFAULT_THRESHOLD;
  const minBaseline = opts.minBaseline ?? DEFAULT_MIN_BASELINE;
  const base: Evaluation = { metric, date, status: "no-data", value: null, baseline: null, dropPct: null, thresholdPct };

  const value = series.get(date);
  if (value === undefined) return base;

  const prior: number[] = [];
  for (let i = 1; i <= BASELINE_DAYS; i++) {
    const v = series.get(addDays(date, -i));
    if (v !== undefined) prior.push(v);
  }
  if (prior.length < MIN_BASELINE_DAYS) return { ...base, value, status: "insufficient-data" };

  const baseline = prior.reduce((a, b) => a + b, 0) / prior.length;
  const result = { ...base, value, baseline };
  if (baseline < minBaseline) return { ...result, status: "low-volume" };

  const dropPct = ((baseline - value) / baseline) * 100;
  let status: EvalStatus = "ok";
  if ((value === 0 && baseline > 0) || dropPct >= 2 * thresholdPct) status = "critical";
  else if (dropPct >= thresholdPct) status = "warning";
  return { ...result, dropPct, status };
}

/** GA4 omits days with no data. Fill every date in [start, end] that is missing with 0. */
export function zeroFill(series: Series, start: string, end: string): Series {
  const out: Series = new Map();
  for (const d of dateRange(start, end)) out.set(d, series.get(d) ?? 0);
  return out;
}

/** Newest date that has data, or null for an empty series. */
export function newestDate(series: Series): string | null {
  let newest: string | null = null;
  for (const d of series.keys()) if (newest === null || d > newest) newest = d;
  return newest;
}

export interface ExistingAlert {
  id: number;
  metric: Metric;
  date: string;
  status: "open" | "acknowledged" | "resolved";
}

export interface NewAlert {
  metric: Metric;
  date: string;
  value: number;
  baseline: number;
  dropPct: number;
  thresholdPct: number;
  severity: Severity;
}

/**
 * Decide what to do for one site:
 *  - insert an alert for each warning/critical evaluation unless one already exists for (metric, date)
 *  - resolve open/acknowledged alerts for a metric that is now back within threshold
 * The database unique constraint on (site_id, metric, date) is the final guard against duplicates.
 */
export function planAlertActions(evaluations: Evaluation[], existing: ExistingAlert[]) {
  const existingKeys = new Set(existing.map((a) => `${a.metric}|${a.date}`));
  const toInsert: NewAlert[] = [];
  const toResolve: number[] = [];

  for (const e of evaluations) {
    if ((e.status === "warning" || e.status === "critical") && !existingKeys.has(`${e.metric}|${e.date}`)) {
      toInsert.push({
        metric: e.metric, date: e.date, value: e.value!, baseline: e.baseline!,
        dropPct: e.dropPct!, thresholdPct: e.thresholdPct, severity: e.status,
      });
    }
    if (e.status === "ok") {
      for (const a of existing) {
        if (a.metric === e.metric && a.status !== "resolved" && a.date <= e.date) toResolve.push(a.id);
      }
    }
  }
  return { toInsert, toResolve };
}
