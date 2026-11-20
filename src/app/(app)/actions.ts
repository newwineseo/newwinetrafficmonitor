"use server";

import { and, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { alerts, dailyMetrics, METRICS, pushSubscriptions, sites, type Metric } from "@/db/schema";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getSettings, parseEmailList, saveSettings } from "@/lib/settings";
import { backfillSite } from "@/lib/sitedata";

/** Server actions are public endpoints, so check the session in each one as well as in middleware. */
async function requireLogin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) throw new Error("Not logged in");
}

function refreshAll() {
  revalidatePath("/", "layout");
}

// ---------- Alerts ----------

export async function acknowledgeAlert(id: number) {
  await requireLogin();
  await db().update(alerts).set({ status: "acknowledged", acknowledgedAt: new Date() })
    .where(and(eq(alerts.id, id), eq(alerts.status, "open")));
  refreshAll();
}

export async function acknowledgeAll() {
  await requireLogin();
  await db().update(alerts).set({ status: "acknowledged", acknowledgedAt: new Date() }).where(eq(alerts.status, "open"));
  refreshAll();
}

// ---------- Sites ----------

export interface FormState { error?: string; ok?: string }

function parseSiteForm(fd: FormData) {
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const optNum = (k: string) => (str(k) === "" ? null : Number(str(k)));
  const metrics = METRICS.filter((m) => fd.get(`metric_${m}`) === "on") as Metric[];

  const values = {
    name: str("name"),
    domain: str("domain").replace(/^https?:\/\//, "").replace(/\/+$/, ""),
    gscProperty: str("gscProperty") || null,
    ga4PropertyId: str("ga4PropertyId").replace(/^properties\//, "") || null,
    timezone: str("timezone") || "Asia/Kolkata",
    thresholdPct: optNum("thresholdPct"),
    minBaseline: optNum("minBaseline"),
    metrics,
    extraRecipients: parseEmailList(str("extraRecipients")),
  };

  if (!values.name) return { error: "Name is required." };
  if (!values.domain) return { error: "Domain is required." };
  if (!metrics.length) return { error: "Choose at least one metric." };
  if (metrics.some((m) => m.startsWith("gsc_")) && !values.gscProperty) return { error: "GSC property is required for GSC metrics." };
  if (metrics.some((m) => m.startsWith("ga4_")) && !values.ga4PropertyId) return { error: "GA4 property ID is required for GA4 metrics." };
  if (values.thresholdPct !== null && !(values.thresholdPct >= 1 && values.thresholdPct <= 95)) return { error: "Threshold must be between 1 and 95." };
  if (values.minBaseline !== null && !(values.minBaseline >= 0)) return { error: "Minimum average must be 0 or more." };
  try {
    new Intl.DateTimeFormat("en", { timeZone: values.timezone });
  } catch {
    return { error: "Unknown time zone." };
  }
  const badEmails = str("extraRecipients").split(/[,;\s]+/).filter((x) => x && !x.includes("@"));
  if (badEmails.length) return { error: `Not an email address: ${badEmails.join(", ")}` };
  return { values };
}

export async function createSite(_: FormState, fd: FormData): Promise<FormState> {
  await requireLogin();
  const parsed = parseSiteForm(fd);
  if (!parsed.values) return { error: parsed.error };

  const [site] = await db().insert(sites).values(parsed.values).returning();
  const cfg = await getSettings();
  const { errors } = await backfillSite(site, cfg.ga4_lag_days);
  await db().update(sites).set({ lastFetchAt: new Date(), lastError: errors.length ? errors.join("; ") : null })
    .where(eq(sites.id, site.id));
  refreshAll();
  redirect(`/sites/${site.id}`);
}

export async function updateSite(id: number, _: FormState, fd: FormData): Promise<FormState> {
  await requireLogin();
  const parsed = parseSiteForm(fd);
  if (!parsed.values) return { error: parsed.error };

  const [before] = await db().select().from(sites).where(eq(sites.id, id));
  if (!before) return { error: "Site not found." };
  const [site] = await db().update(sites).set(parsed.values).where(eq(sites.id, id)).returning();

  // A different property means different data: replace the stored history.
  const propsChanged = before.gscProperty !== site.gscProperty || before.ga4PropertyId !== site.ga4PropertyId;
  if (propsChanged) {
    await db().delete(dailyMetrics).where(eq(dailyMetrics.siteId, id));
    const cfg = await getSettings();
    const { errors } = await backfillSite(site, cfg.ga4_lag_days);
    await db().update(sites).set({ lastFetchAt: new Date(), lastError: errors.length ? errors.join("; ") : null })
      .where(eq(sites.id, id));
  }
  refreshAll();
  redirect(`/sites/${id}`);
}

export async function setSiteActive(id: number, active: boolean) {
  await requireLogin();
  await db().update(sites).set({ active }).where(eq(sites.id, id));
  refreshAll();
}

export async function deleteSite(id: number) {
  await requireLogin();
  await db().delete(sites).where(eq(sites.id, id)); // metrics and alerts cascade
  refreshAll();
  redirect("/sites");
}

// ---------- Settings ----------

export async function updateSettings(_: FormState, fd: FormData): Promise<FormState> {
  await requireLogin();
  const threshold = Number(fd.get("default_threshold"));
  const minBaseline = Number(fd.get("min_baseline"));
  const rawRecipients = String(fd.get("recipients") ?? "");
  const recipients = parseEmailList(rawRecipients);
  const rawCc = String(fd.get("cc_recipients") ?? "");
  const ccRecipients = parseEmailList(rawCc);
  const bad = `${rawRecipients} ${rawCc}`.split(/[,;\s]+/).filter((x) => x && !x.includes("@"));

  if (!(threshold >= 1 && threshold <= 95)) return { error: "Default threshold must be between 1 and 95." };
  if (!(minBaseline >= 0)) return { error: "Minimum average must be 0 or more." };
  if (bad.length) return { error: `Not an email address: ${bad.join(", ")}` };

  await saveSettings({
    default_threshold: threshold,
    min_baseline: minBaseline,
    recipients,
    cc_recipients: ccRecipients,
    email_enabled: fd.get("email_enabled") === "on",
    push_enabled: fd.get("push_enabled") === "on",
  });
  refreshAll();
  return { ok: "Settings saved." };
}

export async function removeDevice(id: number) {
  await requireLogin();
  await db().delete(pushSubscriptions).where(inArray(pushSubscriptions.id, [id]));
  refreshAll();
}
