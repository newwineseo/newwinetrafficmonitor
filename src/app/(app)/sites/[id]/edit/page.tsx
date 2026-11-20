import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { PageTitle } from "@/components/ui";
import { timezoneList } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { updateSite } from "../../../actions";
import { SiteForm } from "../../SiteForm";

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [[site], cfg] = await Promise.all([db().select().from(sites).where(eq(sites.id, id)), getSettings()]);
  if (!site) notFound();

  return (
    <div className="max-w-3xl">
      <PageTitle>Edit {site.name}</PageTitle>
      <p className="mb-4 text-sm text-gray-600">Changing a property replaces the stored history with 90 days from the new property.</p>
      <SiteForm action={updateSite.bind(null, id)} site={site} timezones={timezoneList()}
        defaults={{ threshold: cfg.default_threshold, minBaseline: cfg.min_baseline }} />
    </div>
  );
}
