import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyMetrics, type Metric, type Site } from "@/db/schema";
import { addDays, daysBetween, todayInTz } from "./dates";
import { GSC_STALE_DAYS, newestDate, zeroFill, type Series } from "./detect";
import { fetchGa4, fetchGsc } from "./fetchers";

export interface SiteData {
  series: Partial<Record<Metric, Series>>;
  /** Day to evaluate per metric (GSC: newest date returned, GA4: today minus lag in the site's time zone). */
  evalDate: Partial<Record<Metric, string>>;
  errors: string[];
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Fetch the last `days` days of every enabled metric for one site. Never throws: problems go to `errors`. */
export async function fetchSiteData(site: Site, days: number, ga4LagDays: number, now = new Date()): Promise<SiteData> {
  const out: SiteData = { series: {}, evalDate: {}, errors: [] };
  const today = todayInTz(site.timezone, now);
  const wants = (prefix: string) => site.metrics.some((m) => m.startsWith(prefix));
  const tasks: Promise<void>[] = [];

  if (wants("gsc_")) {
    if (!site.gscProperty) out.errors.push("GSC property is not set");
    else tasks.push(fetchGsc(site.gscProperty, addDays(today, -days), today).then((rows) => {
      const clicks: Series = new Map(rows.map((r) => [r.date, r.clicks]));
      const impressions: Series = new Map(rows.map((r) => [r.date, r.impressions]));
      const newest = newestDate(clicks);
      if (!newest) { out.errors.push(`GSC returned no data for the last ${days} days`); return; }
      const age = daysBetween(newest, today);
      if (age > GSC_STALE_DAYS) {
        out.errors.push(`GSC data is ${age} days old (newest ${newest}); access may have been lost`);
      }
      out.series.gsc_clicks = clicks;
      out.series.gsc_impressions = impressions;
      if (age <= GSC_STALE_DAYS) out.evalDate.gsc_clicks = out.evalDate.gsc_impressions = newest;
    }).catch((e) => { out.errors.push(`GSC: ${errMsg(e)}`); }));
  }

  if (wants("ga4_")) {
    if (!site.ga4PropertyId) out.errors.push("GA4 property is not set");
    else {
      const end = addDays(today, -ga4LagDays);
      const start = addDays(end, -(days - 1));
      tasks.push(fetchGa4(site.ga4PropertyId, start, end).then((rows) => {
        out.series.ga4_sessions = zeroFill(new Map(rows.map((r) => [r.date, r.sessions])), start, end);
        out.series.ga4_organic = zeroFill(new Map(rows.map((r) => [r.date, r.organic])), start, end);
        out.evalDate.ga4_sessions = out.evalDate.ga4_organic = end;
      }).catch((e) => { out.errors.push(`GA4: ${errMsg(e)}`); }));
    }
  }

  await Promise.all(tasks);
  return out;
}

/** Insert or update the fetched values in daily_metrics. */
export async function upsertSiteData(siteId: number, data: SiteData) {
  const rows = Object.entries(data.series).flatMap(([metric, s]) =>
    [...s!.entries()].map(([date, value]) => ({ siteId, metric: metric as Metric, date, value })));
  for (let i = 0; i < rows.length; i += 1000) {
    await db().insert(dailyMetrics).values(rows.slice(i, i + 1000))
      .onConflictDoUpdate({
        target: [dailyMetrics.siteId, dailyMetrics.metric, dailyMetrics.date],
        set: { value: sql`excluded.value` },
      });
  }
  return rows.length;
}

/** Load history for a new site (90 days by default) so charts and baselines work right away. */
export async function backfillSite(site: Site, ga4LagDays: number, days = 90) {
  const data = await fetchSiteData(site, days, ga4LagDays);
  const count = await upsertSiteData(site.id, data);
  return { count, errors: data.errors };
}
