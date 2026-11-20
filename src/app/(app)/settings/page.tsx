import { desc } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { Banner, btn, Card, PageTitle } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { getEmailError, getSettings } from "@/lib/settings";
import { DeviceSettings } from "./DeviceSettings";
import { removeDevice } from "../actions";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const [settings, devices, emailError] = await Promise.all([
    getSettings(),
    db().select().from(pushSubscriptions).orderBy(desc(pushSubscriptions.createdAt)),
    getEmailError(),
  ]);

  return (
    <div className="max-w-3xl space-y-5">
      {emailError && (
        <Banner>Email sending failed: check GMAIL_APP_PASSWORD. Last error {fmtDateTime(new Date(emailError.at))}: {emailError.message}</Banner>
      )}
      <PageTitle>Settings</PageTitle>
      <SettingsForm settings={settings} />
      <DeviceSettings />

      <Card>
        <h2 className="mb-3 font-semibold text-brand">Devices receiving push notifications</h2>
        {devices.length === 0 ? (
          <p className="text-sm text-gray-600">No devices yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <div className="font-medium">{d.deviceLabel || "Unnamed device"}</div>
                  <div className="text-xs text-gray-500">
                    Added {fmtDateTime(d.createdAt)}. Last delivered {fmtDateTime(d.lastSuccessAt)}.
                  </div>
                </div>
                <form action={removeDevice.bind(null, d.id)}>
                  <button className={btn.danger}>Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
