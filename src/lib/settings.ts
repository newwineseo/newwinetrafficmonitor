import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { DEFAULT_MIN_BASELINE, DEFAULT_THRESHOLD } from "./detect";

export interface AppSettings {
  default_threshold: number;
  min_baseline: number;
  recipients: string[];
  /** Copied (CC) on every alert email. */
  cc_recipients: string[];
  email_enabled: boolean;
  push_enabled: boolean;
  ga4_lag_days: number;
}

export function parseEmailList(s: string | undefined | null): string[] {
  return (s ?? "").split(/[,;\s]+/).map((x) => x.trim()).filter((x) => x.includes("@"));
}

function defaults(): AppSettings {
  return {
    default_threshold: DEFAULT_THRESHOLD,
    min_baseline: DEFAULT_MIN_BASELINE,
    recipients: parseEmailList(process.env.ALERT_RECIPIENTS),
    cc_recipients: [],
    email_enabled: true,
    push_enabled: true,
    ga4_lag_days: 1,
  };
}

/** Code defaults (and ALERT_RECIPIENTS) overridden by whatever is stored in the settings table. */
export async function getSettings(): Promise<AppSettings> {
  const rows = await db().select().from(settings);
  const out = defaults() as unknown as Record<string, unknown>;
  for (const r of rows) if (r.key in out) out[r.key] = r.value;
  return out as unknown as AppSettings;
}

export interface EmailError { message: string; at: string }

/** Last email failure (shown as a red banner in Settings), or null once sending works again. */
export async function getEmailError(): Promise<EmailError | null> {
  const [row] = await db().select().from(settings).where(eq(settings.key, "email_error"));
  return (row?.value as EmailError | null) ?? null;
}

export async function recordEmailResult(error: string | null) {
  if (!error) {
    await db().delete(settings).where(eq(settings.key, "email_error"));
    return;
  }
  const value = { message: error, at: new Date().toISOString() };
  await db().insert(settings).values({ key: "email_error", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function saveSettings(values: Partial<AppSettings>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    await db().insert(settings).values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
}
