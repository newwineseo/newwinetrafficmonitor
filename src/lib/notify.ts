// Sends the per-run email digest and push notification, only for NEW alerts and NEW data problems.
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { alerts as alertsTable, type Site } from "@/db/schema";
import { buildDigestEmail, pushContent, type DigestAlert, type DigestProblem } from "./digest";
import type { NewAlert } from "./detect";
import { sendEmail } from "./email";
import { sendPushToAll } from "./push";
import { getSettings, recordEmailResult } from "./settings";

export interface AlertForNotify extends NewAlert { id: number; site: Site }
export interface DataProblem { site: Site; error: string }

export const appUrl = () => process.env.APP_URL || "http://localhost:3000";

export async function notifyRun(alerts: AlertForNotify[], problems: DataProblem[], log: (m: string) => void) {
  const out = { emailsSent: 0, pushesSent: 0 };
  if (!alerts.length && !problems.length) return out;

  const cfg = await getSettings();
  const digestAlerts: DigestAlert[] = alerts.map((a) => ({ ...a, siteName: a.site.name, domain: a.site.domain }));
  const digestProblems: DigestProblem[] = problems.map((p) => ({ siteName: p.site.name, domain: p.site.domain, error: p.error }));
  const ids = alerts.map((a) => a.id);

  // ---- one combined email ----
  if (!cfg.email_enabled) log("Email is turned off in Settings");
  else {
    const sitesInvolved = [...alerts.map((a) => a.site), ...problems.map((p) => p.site)];
    const recipients = [...new Set([...cfg.recipients, ...sitesInvolved.flatMap((s) => s.extraRecipients)].map((e) => e.toLowerCase()))];
    if (!recipients.length) log("No email recipients set; add them in Settings");
    else {
      try {
        const email = buildDigestEmail(digestAlerts, digestProblems, appUrl());
        const r = await sendEmail({ to: recipients, ...email });
        if (r.status === "sent") {
          out.emailsSent = 1;
          if (ids.length) await db().update(alertsTable).set({ emailedAt: new Date() }).where(inArray(alertsTable.id, ids));
          log(`Email sent to ${recipients.length} recipient(s): ${email.subject}`);
        } else {
          log(`Email logged to the console (no email credentials set): ${email.subject}`);
        }
        await recordEmailResult(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log(`Email sending failed: ${msg}`);
        await recordEmailResult(msg);
      }
    }
  }

  // ---- one combined push notification ----
  if (!cfg.push_enabled) log("Push notifications are turned off in Settings");
  else {
    const content = pushContent(digestAlerts, digestProblems);
    if (content) {
      try {
        const r = await sendPushToAll(content);
        out.pushesSent = r.sent;
        if (r.sent && ids.length) await db().update(alertsTable).set({ pushedAt: new Date() }).where(inArray(alertsTable.id, ids));
        log(`Push "${content.title}": ${r.sent} delivered, ${r.removed} expired device(s) removed, ${r.failed} failed` +
          (r.errors.length ? ` (${r.errors.join("; ")})` : ""));
      } catch (e) {
        log(`Push sending failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return out;
}
