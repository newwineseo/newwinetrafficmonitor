import { NextResponse } from "next/server";
import { buildDigestEmail } from "@/lib/digest";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/notify";
import { getSettings, recordEmailResult } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** "Send test email": a sample digest to the team recipients. Login is enforced by middleware. */
export async function POST() {
  const cfg = await getSettings();
  if (!cfg.recipients.length) return NextResponse.json({ error: "Add team recipients first, then save." }, { status: 400 });

  const sample = buildDigestEmail([
    { siteName: "Example Site", domain: "example.com", metric: "ga4_sessions", date: new Date().toISOString().slice(0, 10), value: 0, baseline: 225, dropPct: 100, severity: "critical" },
    { siteName: "Example Site", domain: "example.com", metric: "gsc_clicks", date: new Date().toISOString().slice(0, 10), value: 126, baseline: 232, dropPct: 45.7, severity: "warning" },
  ], [{ siteName: "Another Site", domain: "another.example", error: "Sample data connection problem" }], appUrl());

  try {
    const cc = cfg.cc_recipients.filter((e) => !cfg.recipients.includes(e));
    const r = await sendEmail({ to: cfg.recipients, cc, ...sample, subject: `Test email: ${sample.subject}` });
    await recordEmailResult(null);
    return NextResponse.json({
      ok: true,
      message: r.status === "sent"
        ? `Test email sent to ${cfg.recipients.join(", ")}${cc.length ? `, CC ${cc.join(", ")}` : ""}.`
        : "GMAIL_APP_PASSWORD is empty, so the email was printed to the server console instead of sent.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordEmailResult(msg);
    return NextResponse.json({ error: `Email sending failed: ${msg}` }, { status: 502 });
  }
}
