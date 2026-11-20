import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { StatusPill } from "@/components/StatusPill";
import { btn, Card, PageTitle } from "@/components/ui";
import { fmtDateTime, METRIC_LABEL } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { SiteActions } from "./SiteActions";

export default async function SitesPage() {
  const [list, cfg] = await Promise.all([db().select().from(sites).orderBy(asc(sites.name)), getSettings()]);

  return (
    <>
      <PageTitle actions={<Link href="/sites/new" className={btn.primary}>Add site</Link>}>Sites</PageTitle>
      {list.length === 0 && <Card><p className="text-sm">No sites yet.</p></Card>}
      <ul className="space-y-3">
        {list.map((s) => (
          <li key={s.id}>
            <Card className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/sites/${s.id}`} className="font-medium text-brand hover:underline">{s.name}</Link>
                  <StatusPill kind={s.active ? (s.lastError ? "error" : "ok") : "paused"} label={s.active ? (s.lastError ? "Data error" : "Active") : "Paused"} />
                </div>
                <div className="break-all text-xs text-gray-600">
                  {s.domain}. GSC: {s.gscProperty ?? "not set"}. GA4: {s.ga4PropertyId ?? "not set"}.
                </div>
                <div className="text-xs text-gray-600">
                  Threshold {s.thresholdPct ?? cfg.default_threshold}%{s.thresholdPct === null ? " (default)" : ""},
                  min average {s.minBaseline ?? cfg.min_baseline}{s.minBaseline === null ? " (default)" : ""}, {s.timezone}.
                  Metrics: {s.metrics.map((m) => METRIC_LABEL[m]).join(", ")}.
                  {s.extraRecipients.length > 0 && <> Extra recipients: {s.extraRecipients.join(", ")}.</>}
                </div>
                {s.lastError && <div className="text-xs text-critical">Error: {s.lastError}</div>}
                <div className="text-xs text-gray-500">Last fetched {fmtDateTime(s.lastFetchAt)}</div>
              </div>
              <SiteActions id={s.id} name={s.name} active={s.active} />
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
