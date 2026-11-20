// Temporary Phase 1 page: replaced by the full Overview in Phase 2.
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts, runs, sites } from "@/db/schema";
import { RunCheckButton } from "./RunCheckButton";

export const dynamic = "force-dynamic";

const SEVERITY_CLASS = { critical: "bg-critical", warning: "bg-warning" } as const;

export default async function Home() {
  const [allSites, open, lastRun] = await Promise.all([
    db().select().from(sites).orderBy(sites.name),
    db().select({ a: alerts, siteName: sites.name }).from(alerts)
      .innerJoin(sites, eq(alerts.siteId, sites.id))
      .where(eq(alerts.status, "open")).orderBy(desc(alerts.date)),
    db().select().from(runs).orderBy(desc(runs.startedAt)).limit(1),
  ]);

  return (
    <main>
      <header className="bg-navy px-4 py-3 text-white">
        <h1 className="text-lg font-semibold">NewWine Traffic Monitor</h1>
      </header>
      <div className="mx-auto max-w-5xl space-y-6 p-4">
        <RunCheckButton />
        <p className="text-sm">
          {allSites.length} site(s). Last run: {lastRun[0] ? `${lastRun[0].startedAt.toISOString()} (${lastRun[0].status})` : "never"}
        </p>
        <section>
          <h2 className="mb-2 font-semibold text-brand">Open alerts ({open.length})</h2>
          <ul className="space-y-2">
            {open.map(({ a, siteName }) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded bg-white p-3 text-sm shadow-sm">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase text-white ${SEVERITY_CLASS[a.severity]}`}>{a.severity}</span>
                <span className="font-medium">{siteName}</span>
                <span>{a.metric} on {a.date}: {Math.round(a.value)} vs avg {Math.round(a.baseline)} (down {a.dropPct.toFixed(0)}%)</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 font-semibold text-brand">Sites</h2>
          <ul className="space-y-1 text-sm">
            {allSites.map((s) => (
              <li key={s.id}>{s.name} ({s.domain}){s.lastError ? ` - Error: ${s.lastError}` : ""}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
