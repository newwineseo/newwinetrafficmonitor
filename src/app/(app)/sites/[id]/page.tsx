import Link from "next/link";
import { notFound } from "next/navigation";
import { MetricChart } from "@/components/MetricChart";
import { StatusPill } from "@/components/StatusPill";
import { Banner, btn, Card, PageTitle } from "@/components/ui";
import { fmtDateTime, fmtDay, fmtNum, METRIC_LABEL } from "@/lib/format";
import { getSiteDetail } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { AlertList } from "../../alerts/AlertList";

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const cfg = await getSettings();
  const data = Number.isInteger(id) ? await getSiteDetail(id, cfg) : null;
  if (!data) notFound();
  const { site, details, alerts } = data;
  const threshold = site.thresholdPct ?? cfg.default_threshold;
  const minBaseline = site.minBaseline ?? cfg.min_baseline;

  return (
    <>
      {site.lastError && <Banner>Could not be checked: {site.lastError}</Banner>}
      <PageTitle actions={<Link href={`/sites/${site.id}/edit`} className={btn.secondary}>Edit site</Link>}>
        <span className="block">{site.name}</span>
        <span className="block text-sm font-normal text-gray-600">{site.domain}</span>
      </PageTitle>
      <p className="mb-4 text-xs text-gray-600">
        {!site.active && <><StatusPill kind="paused" />{" "}</>}
        Threshold {threshold}%{site.thresholdPct === null ? " (default)" : ""}, minimum average {minBaseline}
        {site.minBaseline === null ? " (default)" : ""}, time zone {site.timezone}. Last fetched {fmtDateTime(site.lastFetchAt)}.
      </p>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {details.map((d) => (
          <Card key={d.metric} className="p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{METRIC_LABEL[d.metric]}</span>
              <StatusPill kind={d.status} />
            </div>
            <div className="text-2xl font-semibold text-navy">{fmtNum(d.value)}</div>
            <div className="text-xs text-gray-600">
              {d.evalDate ? fmtDay(d.evalDate) : "No data"}
              {d.baseline !== null && <>, 7-day avg {fmtNum(d.baseline)}</>}
              {d.dropPct !== null && <>, {d.dropPct >= 0 ? `down ${d.dropPct.toFixed(1)}%` : `up ${(-d.dropPct).toFixed(1)}%`}</>}
            </div>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {details.map((d) => (
          <Card key={d.metric} className="min-w-0">
            <h2 className="mb-1 font-semibold text-brand">{METRIC_LABEL[d.metric]}, last 90 days</h2>
            <MetricChart title={METRIC_LABEL[d.metric]} points={d.points}
              alerts={alerts.filter((a) => a.metric === d.metric).map((a) => ({ date: a.date, severity: a.severity }))} />
          </Card>
        ))}
      </div>

      <h2 className="mb-2 font-semibold text-brand">Alert history</h2>
      <AlertList items={alerts.map((alert) => ({ alert, siteName: site.name }))} showSite={false}
        empty="No alerts for this site yet." />
    </>
  );
}
