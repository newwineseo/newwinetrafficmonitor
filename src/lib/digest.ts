// Builds the per-run email digest and push notification text. Pure functions, unit-tested.
import type { Metric, Severity } from "@/db/schema";
import { alertLine, fmtDay, fmtNum, METRIC_LABEL } from "./format";

export interface DigestAlert {
  siteName: string;
  domain: string;
  metric: Metric;
  date: string;
  value: number;
  baseline: number;
  dropPct: number;
  severity: Severity;
}

export interface DigestProblem { siteName: string; domain: string; error: string }

const COLORS = { navy: "#0D1B2A", blue: "#1B4F72", accent: "#2E86C1", critical: "#C0392B", warning: "#B9770E", ok: "#1E8449" };

/** Critical first, then the biggest drop. */
export function sortAlerts<T extends { severity: Severity; dropPct: number }>(alerts: T[]): T[] {
  return [...alerts].sort((a, b) =>
    (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1) || b.dropPct - a.dropPct);
}

export function pushContent(alerts: DigestAlert[], problems: DigestProblem[]) {
  if (alerts.length) {
    const sites = new Set(alerts.map((a) => a.siteName));
    const worst = sortAlerts(alerts)[0];
    const title = alerts.length === 1
      ? `Traffic drop: ${worst.siteName}`
      : `${alerts.length} traffic drops on ${sites.size} site${sites.size === 1 ? "" : "s"}`;
    const body = alerts.length === 1 ? alertLine(worst) : `Worst: ${worst.siteName}, ${alertLine(worst)}`;
    return { title, body, url: "/alerts" };
  }
  if (problems.length) {
    return {
      title: problems.length === 1 ? `Data problem: ${problems[0].siteName}` : `Data problems on ${problems.length} sites`,
      body: problems.length === 1 ? problems[0].error : problems.map((p) => p.siteName).join(", "),
      url: "/",
    };
  }
  return null;
}

export function emailSubject(alerts: DigestAlert[], problems: DigestProblem[]): string {
  const crit = alerts.filter((a) => a.severity === "critical").length;
  const warn = alerts.length - crit;
  const parts: string[] = [];
  if (crit) parts.push(`${crit} critical`);
  if (warn) parts.push(`${warn} warning${warn === 1 ? "" : "s"}`);
  if (problems.length) parts.push(`${problems.length} data problem${problems.length === 1 ? "" : "s"}`);
  if (alerts.length === 1 && !problems.length) return `Traffic drop: ${alerts[0].siteName} (${alerts[0].severity})`;
  return `Traffic monitor: ${parts.join(", ")}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildDigestEmail(alerts: DigestAlert[], problems: DigestProblem[], appUrl: string) {
  const sorted = sortAlerts(alerts);
  const critical = sorted.filter((a) => a.severity === "critical");
  const warnings = sorted.filter((a) => a.severity === "warning");
  const dashboard = appUrl.replace(/\/+$/, "") || "http://localhost:3000";

  // ---- plain text ----
  const t: string[] = ["NewWine Traffic Monitor", ""];
  const textSection = (title: string, list: DigestAlert[]) => {
    if (!list.length) return;
    t.push(`${title} (${list.length})`);
    for (const a of list) t.push(`- ${a.siteName} (${a.domain}): ${alertLine(a)} on ${fmtDay(a.date)}`);
    t.push("");
  };
  textSection("CRITICAL", critical);
  textSection("WARNING", warnings);
  if (problems.length) {
    t.push(`DATA CONNECTION PROBLEMS (${problems.length})`);
    for (const p of problems) t.push(`- ${p.siteName} (${p.domain}): could not be checked. ${p.error}`);
    t.push("");
  }
  t.push(`Open dashboard: ${dashboard}/alerts`);

  // ---- HTML: table layout and inline CSS so it renders in Gmail and Outlook ----
  const alertRows = (list: DigestAlert[], label: string, color: string) => list.map((a) => `
          <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #E5E7EB;vertical-align:top;">
              <span style="display:inline-block;padding:2px 8px;border-radius:3px;background:${color};color:#FFFFFF;font-size:12px;font-weight:bold;">${label}</span>
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #E5E7EB;vertical-align:top;font-size:14px;color:${COLORS.navy};">
              <strong>${esc(a.siteName)}</strong><br>
              <span style="color:#6B7280;font-size:12px;">${esc(a.domain)}</span>
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #E5E7EB;vertical-align:top;font-size:14px;color:${COLORS.navy};">
              ${esc(METRIC_LABEL[a.metric])} down <strong>${Math.round(a.dropPct)}%</strong><br>
              <span style="color:#6B7280;font-size:12px;">${fmtNum(a.value)} vs 7-day avg ${fmtNum(a.baseline)}, ${fmtDay(a.date)}</span>
            </td>
          </tr>`).join("");

  const section = (title: string, rows: string) => `
      <tr><td style="padding:20px 24px 4px 24px;font-size:16px;font-weight:bold;color:${COLORS.blue};">${title}</td></tr>
      <tr><td style="padding:0 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}
        </table>
      </td></tr>`;

  const problemRows = problems.map((p) => `
          <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #E5E7EB;vertical-align:top;">
              <span style="display:inline-block;padding:2px 8px;border-radius:3px;border:1px solid ${COLORS.critical};color:${COLORS.critical};font-size:12px;font-weight:bold;">Data error</span>
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #E5E7EB;vertical-align:top;font-size:14px;color:${COLORS.navy};">
              <strong>${esc(p.siteName)}</strong> could not be checked.<br>
              <span style="color:#6B7280;font-size:12px;">${esc(p.error)}</span>
            </td>
          </tr>`).join("");

  const summary = [
    critical.length ? `${critical.length} critical` : "",
    warnings.length ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : "",
    problems.length ? `${problems.length} data problem${problems.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(", ");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(emailSubject(alerts, problems))}</title></head>
<body style="margin:0;padding:0;background:#F4F6F8;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8;">
  <tr><td align="center" style="padding:16px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#FFFFFF;border-collapse:collapse;">
      <tr><td style="background:${COLORS.navy};padding:18px 24px;color:#FFFFFF;font-size:18px;font-weight:bold;">NewWine Traffic Monitor</td></tr>
      <tr><td style="padding:16px 24px 0 24px;font-size:14px;color:${COLORS.navy};">Today's check found: <strong>${esc(summary)}</strong>.</td></tr>
      ${critical.length ? section(`Critical (${critical.length})`, alertRows(critical, "Critical", COLORS.critical)) : ""}
      ${warnings.length ? section(`Warnings (${warnings.length})`, alertRows(warnings, "Warning", COLORS.warning)) : ""}
      ${problems.length ? section(`Data connection problems (${problems.length})`, problemRows) : ""}
      <tr><td align="left" style="padding:24px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="background:${COLORS.accent};border-radius:4px;">
            <a href="${esc(dashboard)}/alerts" style="display:inline-block;padding:12px 22px;color:#FFFFFF;font-size:15px;font-weight:bold;text-decoration:none;">Open dashboard</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:0 24px 20px 24px;font-size:12px;color:#6B7280;">Drops compare the latest day with the average of the 7 days before it. You get this email because you are on the NewWine alert list.</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  return { subject: emailSubject(alerts, problems), text: t.join("\n"), html };
}
