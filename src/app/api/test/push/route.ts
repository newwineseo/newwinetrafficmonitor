import { NextResponse } from "next/server";
import { sendPushToAll } from "@/lib/push";

export const dynamic = "force-dynamic";

/** "Send test notification" to every saved device. Login is enforced by middleware. */
export async function POST() {
  const r = await sendPushToAll({
    title: "Test notification",
    body: "Traffic drop alerts will appear like this.",
    url: "/alerts",
  });
  if (!r.sent && !r.removed && !r.failed && !r.errors.length) {
    return NextResponse.json({ error: "No devices yet. Use Enable alerts on this device first." }, { status: 400 });
  }
  const parts = [`Sent to ${r.sent} device(s)`];
  if (r.removed) parts.push(`${r.removed} expired device(s) removed`);
  if (r.failed || r.errors.length) parts.push(`problems: ${r.errors.join("; ")}`);
  return NextResponse.json({ ok: r.sent > 0, message: parts.join(", ") + "." }, { status: r.sent > 0 ? 200 : 502 });
}
