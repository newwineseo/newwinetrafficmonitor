import { count } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { DEMO_SITES } from "./demo";
import { backfillSite } from "./sitedata";

/** In DEMO_MODE, create the 4 demo sites (with 90 days of history) when there are no sites at all. */
export async function ensureDemoSites(ga4LagDays: number, log: (m: string) => void) {
  if (process.env.DEMO_MODE !== "1") return;
  const [{ n }] = await db().select({ n: count() }).from(sites);
  if (n > 0) return;

  const created = await db().insert(sites).values(DEMO_SITES.map((d) => ({
    name: d.name,
    domain: d.domain,
    gscProperty: `demo:${d.key}`,
    ga4PropertyId: `demo:${d.key}`,
    timezone: "Asia/Kolkata",
  }))).returning();
  await Promise.all(created.map((s) => backfillSite(s, ga4LagDays)));
  log(`Demo mode: created ${created.length} demo sites with 90 days of history`);
}
