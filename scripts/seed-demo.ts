// Creates the 4 demo sites (only when the sites table is empty). Pass --reset to wipe all data first.
import "./env";
import { db } from "@/db";
import { alerts, dailyMetrics, runs, sites } from "@/db/schema";
import { ensureDemoSites } from "@/lib/seed";

async function main() {
  if (process.env.DEMO_MODE !== "1") throw new Error("Set DEMO_MODE=1 in .env.local first");
  if (process.argv.includes("--reset")) {
    await db().delete(alerts);
    await db().delete(dailyMetrics);
    await db().delete(runs);
    await db().delete(sites);
    console.log("Deleted all sites, metrics, alerts and runs.");
  }
  await ensureDemoSites(1, console.log);
  console.log("Done.");
}
main().catch((e) => { console.error(e); process.exit(1); });
