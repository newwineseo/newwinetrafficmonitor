import { PageTitle } from "@/components/ui";
import { timezoneList } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { createSite } from "../../actions";
import { SiteForm } from "../SiteForm";

export default async function NewSitePage() {
  const cfg = await getSettings();
  return (
    <div className="max-w-3xl">
      <PageTitle>Add site</PageTitle>
      <p className="mb-4 text-sm text-gray-600">
        The last 90 days are loaded when you add the site. In demo mode, use properties starting with demo:, for example demo:steady.
      </p>
      <SiteForm action={createSite} timezones={timezoneList()}
        defaults={{ threshold: cfg.default_threshold, minBaseline: cfg.min_baseline }} />
    </div>
  );
}
