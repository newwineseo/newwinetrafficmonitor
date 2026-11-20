import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { alerts, sites } from "@/db/schema";
import { alertLine } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Polled every 60 seconds by the open app to play the alert sound and update the badge. */
export async function GET() {
  const [[counts], [latest]] = await Promise.all([
    db().select({
      open: sql<number>`count(*) filter (where ${alerts.status} = 'open')`.mapWith(Number),
      critical: sql<number>`count(*) filter (where ${alerts.status} = 'open' and ${alerts.severity} = 'critical')`.mapWith(Number),
      maxId: sql<number>`coalesce(max(${alerts.id}), 0)`.mapWith(Number),
    }).from(alerts),
    db().select({ a: alerts, siteName: sites.name }).from(alerts)
      .innerJoin(sites, eq(alerts.siteId, sites.id))
      .where(eq(alerts.status, "open"))
      .orderBy(desc(alerts.id)).limit(1),
  ]);
  return NextResponse.json({
    open: counts.open,
    critical: counts.critical,
    latestId: counts.maxId,
    latest: latest ? { id: latest.a.id, siteName: latest.siteName, severity: latest.a.severity, text: alertLine(latest.a) } : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
