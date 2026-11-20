import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { alerts, dailyMetrics, runs, sites, type Alert, type Metric, type Site } from "@/db/schema";
import { addDays } from "./dates";
import { evaluateMetric, newestDate, type EvalStatus, type Series } from "./detect";
import type { AppSettings } from "./settings";

export interface Point { date: string; value: number }

/** Latest value compared with the average of the 7 days before it. */
export interface Snapshot { date: string; value: number; avg: number | null; changePct: number | null }

export function snapshot(points: Point[]): Snapshot | null {
  if (!points.length) return null;
  const series: Series = new Map(points.map((p) => [p.date, p.value]));
  const date = newestDate(series)!;
  const prior: number[] = [];
  for (let i = 1; i <= 7; i++) {
    const v = series.get(addDays(date, -i));
    if (v !== undefined) prior.push(v);
  }
  const avg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
  const value = series.get(date)!;
  return { date, value, avg, changePct: avg ? ((value - avg) / avg) * 100 : null };
}

export type SiteState = "critical" | "warning" | "error" | "paused" | "ok";

export function siteState(site: Site, openCritical: number, openWarning: number): SiteState {
  if (!site.active) return "paused";
  if (openCritical) return "critical";
  if (openWarning) return "warning";
  if (site.lastError) return "error";
  return "ok";
}

const utcToday = () => new Date().toISOString().slice(0, 10);

/** Daily values per site and metric since `fromDate`, sorted by date. */
async function loadSeries(siteIds: number[], metrics: Metric[], fromDate: string) {
  const out = new Map<string, Point[]>(); // key: `${siteId}|${metric}`
  if (!siteIds.length) return out;
  const rows = await db().select().from(dailyMetrics)
    .where(and(inArray(dailyMetrics.siteId, siteIds), inArray(dailyMetrics.metric, metrics), gte(dailyMetrics.date, fromDate)))
    .orderBy(asc(dailyMetrics.date));
  for (const r of rows) {
    const k = `${r.siteId}|${r.metric}`;
    if (!out.has(k)) out.set(k, []);
    out.get(k)!.push({ date: r.date, value: r.value });
  }
  return out;
}

export async function getOverview() {
  const [allSites, openCounts, lastRun, lastGoodRun] = await Promise.all([
    db().select().from(sites).orderBy(asc(sites.name)),
    db().select({
      siteId: alerts.siteId,
      critical: sql<number>`count(*) filter (where ${alerts.severity} = 'critical')`.mapWith(Number),
      warning: sql<number>`count(*) filter (where ${alerts.severity} = 'warning')`.mapWith(Number),
    }).from(alerts).where(eq(alerts.status, "open")).groupBy(alerts.siteId),
    db().select().from(runs).orderBy(desc(runs.startedAt)).limit(1),
    db().select().from(runs)
      .where(and(inArray(runs.status, ["success", "partial"]), isNotNull(runs.finishedAt)))
      .orderBy(desc(runs.startedAt)).limit(1),
  ]);

  // 30 days for the sparklines, plus 7 more so the first sparkline day still has an average.
  const series = await loadSeries(allSites.map((s) => s.id), ["gsc_clicks", "ga4_sessions"], addDays(utcToday(), -40));
  const counts = new Map(openCounts.map((c) => [c.siteId, c]));

  const rows = allSites.map((site) => {
    const c = counts.get(site.id) ?? { critical: 0, warning: 0 };
    const clicks = series.get(`${site.id}|gsc_clicks`) ?? [];
    const sessions = series.get(`${site.id}|ga4_sessions`) ?? [];
    return {
      site,
      state: siteState(site, c.critical, c.warning),
      openAlerts: c.critical + c.warning,
      clicks: { snap: site.metrics.includes("gsc_clicks") ? snapshot(clicks) : null, spark: clicks.slice(-30) },
      sessions: { snap: site.metrics.includes("ga4_sessions") ? snapshot(sessions) : null, spark: sessions.slice(-30) },
    };
  });

  const activeSites = allSites.filter((s) => s.active);
  return {
    rows,
    tiles: {
      sitesMonitored: activeSites.length,
      openAlerts: openCounts.reduce((n, c) => n + c.critical + c.warning, 0),
      openCritical: openCounts.reduce((n, c) => n + c.critical, 0),
      sitesWithErrors: activeSites.filter((s) => s.lastError).length,
    },
    lastRun: lastRun[0] ?? null,
    lastGoodRun: lastGoodRun[0] ?? null,
  };
}

export interface MetricDetail {
  metric: Metric;
  points: Point[];
  status: EvalStatus;
  evalDate: string | null;
  value: number | null;
  baseline: number | null;
  dropPct: number | null;
}

export async function getSiteDetail(id: number, cfg: AppSettings) {
  const [site] = await db().select().from(sites).where(eq(sites.id, id));
  if (!site) return null;
  const metrics = site.metrics as Metric[];
  const [series, siteAlerts] = await Promise.all([
    loadSeries([id], metrics, addDays(utcToday(), -97)),
    db().select().from(alerts).where(eq(alerts.siteId, id)).orderBy(desc(alerts.date), asc(alerts.metric)),
  ]);

  const details: MetricDetail[] = metrics.map((metric) => {
    const points = series.get(`${id}|${metric}`) ?? [];
    const s: Series = new Map(points.map((p) => [p.date, p.value]));
    const evalDate = newestDate(s);
    const e = evalDate
      ? evaluateMetric(metric, s, evalDate, {
          thresholdPct: site.thresholdPct ?? cfg.default_threshold,
          minBaseline: site.minBaseline ?? cfg.min_baseline,
        })
      : null;
    return {
      metric,
      points: points.slice(-90),
      status: e?.status ?? "no-data",
      evalDate,
      value: e?.value ?? null,
      baseline: e?.baseline ?? null,
      dropPct: e?.dropPct ?? null,
    };
  });

  return { site, details, alerts: siteAlerts };
}

export type AlertTab = "open" | "acknowledged" | "resolved" | "all";

export async function getAlerts(tab: AlertTab) {
  const where = tab === "all" ? undefined : eq(alerts.status, tab);
  const [list, counts] = await Promise.all([
    db().select({ alert: alerts, siteName: sites.name }).from(alerts)
      .innerJoin(sites, eq(alerts.siteId, sites.id))
      .where(where)
      .orderBy(desc(alerts.date), sql`case when ${alerts.severity} = 'critical' then 0 else 1 end`, asc(sites.name))
      .limit(300),
    db().select({ status: alerts.status, n: sql<number>`count(*)`.mapWith(Number) }).from(alerts).groupBy(alerts.status),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<Record<Alert["status"], number>>;
  return {
    list,
    counts: {
      open: byStatus.open ?? 0,
      acknowledged: byStatus.acknowledged ?? 0,
      resolved: byStatus.resolved ?? 0,
      all: counts.reduce((n, c) => n + c.n, 0),
    },
  };
}
