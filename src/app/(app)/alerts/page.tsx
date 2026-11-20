import Link from "next/link";
import { btn, PageTitle } from "@/components/ui";
import { getAlerts, type AlertTab } from "@/lib/queries";
import { acknowledgeAll } from "../actions";
import { AlertList } from "./AlertList";

const TABS: { key: AlertTab; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const requested = (await searchParams).tab;
  const tab: AlertTab = TABS.some((t) => t.key === requested) ? (requested as AlertTab) : "open";
  const { list, counts } = await getAlerts(tab);

  return (
    <>
      <PageTitle actions={counts.open > 0 ? (
        <form action={acknowledgeAll}><button className={btn.primary}>Acknowledge all ({counts.open})</button></form>
      ) : undefined}>Alerts</PageTitle>

      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Alert status">
        {TABS.map((t) => (
          <Link key={t.key} href={`/alerts?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t.key ? "border-accent font-semibold text-navy" : "border-transparent text-gray-600 hover:text-navy"}`}>
            {t.label} ({counts[t.key]})
          </Link>
        ))}
      </nav>

      <AlertList items={list} empty={tab === "open" ? "No open alerts. All monitored sites are within their thresholds." : "No alerts here."} />
    </>
  );
}
