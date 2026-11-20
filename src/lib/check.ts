import { and, eq, gte, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { alerts, runs, sites, type Metric, type Site } from "@/db/schema";
import { addDays, todayInTz } from "./dates";
import { evaluateMetric, planAlertActions, type Evaluation } from "./detect";
import { notifyRun, type AlertForNotify, type DataProblem } from "./notify";
import { ensureDemoSites } from "./seed";
import { getSettings, type AppSettings } from "./settings";
import { fetchSiteData, upsertSiteData } from "./sitedata";

const FETCH_DAYS = 16;

interface SiteOutcome {
  site: Site;
  evaluations: Evaluation[];
  newAlerts: AlertForNotify[];
  resolved: number;
  error: string | null;
  isNewError: boolean;
}

async function checkSite(site: Site, cfg: AppSettings, log: (m: string) => void): Promise<SiteOutcome> {
  const now = new Date();
  const data = await fetchSiteData(site, FETCH_DAYS, cfg.ga4_lag_days, now);
  await upsertSiteData(site.id, data);

  const evaluations: Evaluation[] = [];
  for (const metric of site.metrics as Metric[]) {
    const series = data.series[metric];
    const date = data.evalDate[metric];
    if (!series || !date) continue;
    evaluations.push(evaluateMetric(metric, series, date, {
      thresholdPct: site.thresholdPct ?? cfg.default_threshold,
      minBaseline: site.minBaseline ?? cfg.min_baseline,
    }));
  }

  // Existing alerts that matter: anything still open/acknowledged, plus recent ones for dedup.
  const recentFrom = addDays(todayInTz(site.timezone, now), -FETCH_DAYS);
  const existing = await db().select({ id: alerts.id, metric: alerts.metric, date: alerts.date, status: alerts.status })
    .from(alerts)
    .where(and(eq(alerts.siteId, site.id),
      or(inArray(alerts.status, ["open", "acknowledged"]), gte(alerts.date, recentFrom))));

  const { toInsert, toResolve } = planAlertActions(evaluations, existing);

  // The unique (site_id, metric, date) constraint makes re-runs safe even if two runs overlap.
  const inserted = toInsert.length
    ? await db().insert(alerts).values(toInsert.map((a) => ({ ...a, siteId: site.id })))
        .onConflictDoNothing({ target: [alerts.siteId, alerts.metric, alerts.date] }).returning()
    : [];
  if (toResolve.length) {
    await db().update(alerts).set({ status: "resolved", resolvedAt: now }).where(inArray(alerts.id, toResolve));
  }

  const error = data.errors.length ? data.errors.join("; ") : null;
  await db().update(sites).set({ lastFetchAt: now, lastError: error }).where(eq(sites.id, site.id));

  const summary = evaluations.map((e) =>
    `${e.metric} ${e.date} ${e.status}${e.dropPct !== null ? ` (${e.dropPct.toFixed(1)}%)` : ""}`).join(", ");
  log(`${site.name}: ${summary || "nothing evaluated"}${inserted.length ? `; ${inserted.length} new alert(s)` : ""}` +
    `${toResolve.length ? `; ${toResolve.length} resolved` : ""}${error ? `; ERROR ${error}` : ""}`);

  return {
    site,
    evaluations,
    newAlerts: inserted.map((a) => ({ ...a, site })),
    resolved: toResolve.length,
    error,
    isNewError: !!error && error !== site.lastError,
  };
}

export interface CheckResult {
  runId: number;
  status: "success" | "partial" | "failed";
  sitesChecked: number;
  alertsCreated: number;
  alertsResolved: number;
  emailsSent: number;
  pushesSent: number;
  durationMs: number;
  log: string[];
}

/** The daily check, shared by the cron route and the "Run check now" button. */
export async function runCheck(trigger: "cron" | "manual"): Promise<CheckResult> {
  const t0 = Date.now();
  const lines: string[] = [];
  const log = (m: string) => { lines.push(`${new Date().toISOString().slice(11, 19)} ${m}`); };
  const [run] = await db().insert(runs).values({ trigger }).returning({ id: runs.id });

  const result: CheckResult = {
    runId: run.id, status: "success", sitesChecked: 0, alertsCreated: 0, alertsResolved: 0,
    emailsSent: 0, pushesSent: 0, durationMs: 0, log: lines,
  };

  try {
    const cfg = await getSettings();
    await ensureDemoSites(cfg.ga4_lag_days, log);
    const active = await db().select().from(sites).where(eq(sites.active, true));
    log(`Checking ${active.length} active site(s)`);

    const settled = await Promise.allSettled(active.map((s) => checkSite(s, cfg, log)));
    const newAlerts: AlertForNotify[] = [];
    const problems: DataProblem[] = [];

    settled.forEach((r, i) => {
      if (r.status === "rejected") {
        result.status = "partial";
        log(`${active[i].name}: FAILED ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
        return;
      }
      result.sitesChecked++;
      result.alertsResolved += r.value.resolved;
      newAlerts.push(...r.value.newAlerts);
      if (r.value.error) result.status = "partial";
      if (r.value.isNewError) problems.push({ site: r.value.site, error: r.value.error! });
    });
    result.alertsCreated = newAlerts.length;

    const sent = await notifyRun(newAlerts, problems, log);
    result.emailsSent = sent.emailsSent;
    result.pushesSent = sent.pushesSent;
  } catch (e) {
    result.status = "failed";
    log(`Run failed: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  }

  result.durationMs = Date.now() - t0;
  log(`Finished in ${(result.durationMs / 1000).toFixed(1)}s: ${result.alertsCreated} new alert(s), ${result.alertsResolved} resolved`);
  await db().update(runs).set({
    finishedAt: new Date(),
    status: result.status,
    sitesChecked: result.sitesChecked,
    alertsCreated: result.alertsCreated,
    emailsSent: result.emailsSent,
    pushesSent: result.pushesSent,
    log: lines.join("\n"),
  }).where(eq(runs.id, run.id));
  return result;
}
