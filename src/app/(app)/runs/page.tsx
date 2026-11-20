import { desc } from "drizzle-orm";
import { db } from "@/db";
import { runs } from "@/db/schema";
import { StatusPill } from "@/components/StatusPill";
import { Card, PageTitle } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export default async function RunsPage() {
  const list = await db().select().from(runs).orderBy(desc(runs.startedAt)).limit(60);

  return (
    <>
      <PageTitle>Run history</PageTitle>
      <p className="mb-4 text-sm text-gray-600">The last 60 checks. The daily check runs at 09:00 IST.</p>
      {list.length === 0 && <Card><p className="text-sm">No checks have run yet.</p></Card>}
      <ul className="space-y-2">
        {list.map((r) => {
          const secs = r.finishedAt ? ((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000).toFixed(1) : null;
          return (
            <li key={r.id}>
              <Card className="p-3">
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <StatusPill kind={r.status} />
                    <span className="font-medium">{fmtDateTime(r.startedAt)}</span>
                    <span className="text-gray-600">{r.trigger === "cron" ? "Scheduled" : "Manual"}</span>
                    <span className="text-gray-600">
                      {r.sitesChecked} site{r.sitesChecked === 1 ? "" : "s"}, {r.alertsCreated} new alert{r.alertsCreated === 1 ? "" : "s"},
                      {" "}{r.emailsSent} email{r.emailsSent === 1 ? "" : "s"}, {r.pushesSent} push{r.pushesSent === 1 ? "" : "es"}
                      {secs && `, ${secs}s`}
                    </span>
                    <span className="ml-auto text-xs text-brand underline">Log</span>
                  </summary>
                  <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-gray-50 p-3 text-xs">{r.log || "No log."}</pre>
                </details>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
