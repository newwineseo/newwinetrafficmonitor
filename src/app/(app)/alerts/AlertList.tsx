import Link from "next/link";
import type { Alert } from "@/db/schema";
import { StatusPill } from "@/components/StatusPill";
import { btn, Card } from "@/components/ui";
import { fmtDateTime, fmtDay, fmtNum, METRIC_LABEL } from "@/lib/format";
import { acknowledgeAlert } from "../actions";

export function AlertList({ items, showSite = true, empty }: {
  items: { alert: Alert; siteName: string }[]; showSite?: boolean; empty: string;
}) {
  if (!items.length) return <Card><p className="text-sm text-gray-600">{empty}</p></Card>;
  return (
    <ul className="space-y-2">
      {items.map(({ alert: a, siteName }) => (
        <li key={a.id}>
          <Card className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill kind={a.severity} />
                <StatusPill kind={a.status} />
                {showSite && <Link href={`/sites/${a.siteId}`} className="font-medium text-brand hover:underline">{siteName}</Link>}
              </div>
              <div className="text-sm">
                <span className="font-semibold">{METRIC_LABEL[a.metric]}</span> on {fmtDay(a.date)}:{" "}
                {fmtNum(a.value)} vs 7-day avg {fmtNum(a.baseline)}, down {a.dropPct.toFixed(1)}%
                <span className="text-gray-600"> (threshold {a.thresholdPct}%)</span>
              </div>
              <div className="text-xs text-gray-500">
                Raised {fmtDateTime(a.createdAt)}
                {a.acknowledgedAt && <>, acknowledged {fmtDateTime(a.acknowledgedAt)}</>}
                {a.resolvedAt && <>, resolved {fmtDateTime(a.resolvedAt)}</>}
              </div>
            </div>
            {a.status === "open" && (
              <form action={acknowledgeAlert.bind(null, a.id)} className="shrink-0">
                <button className={btn.secondary}>Acknowledge</button>
              </form>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}
