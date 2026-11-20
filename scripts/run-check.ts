// Runs the daily check once from the command line and prints the result plus alert counts.
import "./env";
import { count, sql } from "drizzle-orm";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { runCheck } from "@/lib/check";

async function main() {
  const r = await runCheck("manual");
  console.log(r.log.join("\n"));
  console.log(`\nStatus ${r.status}, ${r.sitesChecked} site(s), ${r.alertsCreated} new alert(s), ${(r.durationMs / 1000).toFixed(1)}s`);
  const byKind = await db().select({ severity: alerts.severity, status: alerts.status, n: count() })
    .from(alerts).groupBy(alerts.severity, alerts.status);
  const dupes = await db().execute(sql`select site_id, metric, date, count(*) from alerts group by 1, 2, 3 having count(*) > 1`);
  console.log("Alerts in database:", byKind.map((x) => `${x.n} ${x.severity}/${x.status}`).join(", ") || "none");
  console.log("Duplicate (site, metric, date) rows:", dupes.rows.length);
  if (r.status === "failed") process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
