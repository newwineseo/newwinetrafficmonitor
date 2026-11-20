import Link from "next/link";
import { RunCheckButton } from "@/components/RunCheckButton";
import { Sparkline } from "@/components/Sparkline";
import { StatusPill } from "@/components/StatusPill";
import { Banner, Card, PageTitle } from "@/components/ui";
import { fmtAgo, fmtChange, fmtDateTime, fmtDay, fmtNum } from "@/lib/format";
import { getOverview, type Point, type Snapshot } from "@/lib/queries";

const STALE_HOURS = 26;

export default async function OverviewPage() {
  const { rows, tiles, lastRun, lastGoodRun } = await getOverview();
  const lastGoodAt = lastGoodRun?.finishedAt ?? null;
  const stale = !lastGoodAt || Date.now() - lastGoodAt.getTime() > STALE_HOURS * 3600_000;

  return (
    <>
      {stale && (
        <Banner>
          Daily check did not run. {lastGoodAt ? `The last successful check was ${fmtAgo(lastGoodAt)} (${fmtDateTime(lastGoodAt)}).` : "No successful check has run yet."}
        </Banner>
      )}
      <PageTitle actions={<RunCheckButton />}>Overview</PageTitle>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Sites monitored" value={String(tiles.sitesMonitored)} />
        <Tile label="Open alerts" value={String(tiles.openAlerts)}
          sub={tiles.openCritical ? `${tiles.openCritical} critical` : "None critical"}
          tone={tiles.openCritical ? "critical" : tiles.openAlerts ? "warning" : undefined} href="/alerts" />
        <Tile label="Sites with data errors" value={String(tiles.sitesWithErrors)}
          tone={tiles.sitesWithErrors ? "critical" : undefined} />
        <Tile label="Last check" value={lastRun ? fmtAgo(lastRun.startedAt) : "Never"}
          sub={lastRun ? `${fmtDateTime(lastRun.startedAt)}, ${lastRun.status}` : undefined} href="/runs" />
      </div>

      {rows.length === 0 ? (
        <Card><p className="text-sm">No sites yet. <Link href="/sites/new" className="text-accent underline">Add a site</Link> or run a check in demo mode.</p></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy text-white">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Site</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">GSC clicks</th>
                  <th className="px-3 py-2.5 font-semibold">GA4 sessions</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Open alerts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.site.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/sites/${r.site.id}`} className="font-medium text-brand hover:underline">{r.site.name}</Link>
                      <div className="text-xs text-gray-500">{r.site.domain}</div>
                    </td>
                    <td className="px-3 py-3"><StatusPill kind={r.state} /></td>
                    <td className="px-3 py-3"><MetricCell snap={r.clicks.snap} spark={r.clicks.spark} label="GSC clicks" /></td>
                    <td className="px-3 py-3"><MetricCell snap={r.sessions.snap} spark={r.sessions.spark} label="GA4 sessions" /></td>
                    <td className="px-4 py-3 text-right font-semibold">{r.openAlerts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((r) => (
              <Card key={r.site.id}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/sites/${r.site.id}`} className="font-medium text-brand">{r.site.name}</Link>
                    <div className="truncate text-xs text-gray-500">{r.site.domain}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusPill kind={r.state} />
                    <span className="text-xs">{r.openAlerts} open alert{r.openAlerts === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                  <div><div className="mb-1 text-xs font-semibold text-gray-600">GSC clicks</div><MetricCell snap={r.clicks.snap} spark={r.clicks.spark} label="GSC clicks" /></div>
                  <div><div className="mb-1 text-xs font-semibold text-gray-600">GA4 sessions</div><MetricCell snap={r.sessions.snap} spark={r.sessions.spark} label="GA4 sessions" /></div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Tile({ label, value, sub, tone, href }: { label: string; value: string; sub?: string; tone?: "critical" | "warning"; href?: string }) {
  const border = tone === "critical" ? "border-l-critical" : tone === "warning" ? "border-l-warning" : "border-l-accent";
  const body = (
    <div className={`h-full rounded-lg border-l-4 bg-white p-3 shadow-sm ${border}`}>
      <div className="text-xs font-medium text-gray-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-navy">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-600">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function MetricCell({ snap, spark, label }: { snap: Snapshot | null; spark: Point[]; label: string }) {
  if (!snap) return <span className="text-xs text-gray-500">Not tracked</span>;
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-[88px]">
        <div className="font-semibold">{fmtNum(snap.value)}</div>
        <div className="text-xs text-gray-600">avg {fmtNum(snap.avg)}, {fmtChange(snap.changePct)}</div>
        <div className="text-xs text-gray-500">{fmtDay(snap.date)}</div>
      </div>
      <Sparkline points={spark} label={label} width={96} />
    </div>
  );
}
