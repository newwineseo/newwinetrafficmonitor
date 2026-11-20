"use client";

import { startTransition, useActionState } from "react";
import { btn, Card, input } from "@/components/ui";
import type { AppSettings } from "@/lib/settings";
import { updateSettings } from "../actions";

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, action, pending] = useActionState(updateSettings, {});
  // With JavaScript loaded, submit manually so React does not reset the fields after the action
  // (keeps input on errors). Without it, the form action still posts normally.
  return (
    <form action={action} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}>
      <Card className="space-y-4">
        <h2 className="font-semibold text-brand">Alert rules and recipients</h2>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div>
            <label htmlFor="default_threshold" className="mb-1 block text-sm font-medium">Default threshold %</label>
            <input id="default_threshold" name="default_threshold" type="number" min={1} max={95} step="any" required
              defaultValue={settings.default_threshold} className={input} />
          </div>
          <div>
            <label htmlFor="min_baseline" className="mb-1 block text-sm font-medium">Min average</label>
            <input id="min_baseline" name="min_baseline" type="number" min={0} step="any" required
              defaultValue={settings.min_baseline} className={input} />
          </div>
        </div>
        <p className="text-xs text-gray-600">
          Warning when a metric falls by the threshold or more against its 7-day average; critical at twice the threshold or when it falls to 0.
          Metrics whose 7-day average is below the minimum are skipped. Sites can override both.
        </p>
        <div>
          <label htmlFor="recipients" className="mb-1 block text-sm font-medium">Team recipients</label>
          <textarea id="recipients" name="recipients" rows={3} defaultValue={settings.recipients.join(", ")} className={input}
            placeholder="name@example.com, other@example.com" />
          <p className="mt-1 text-xs text-gray-500">Comma-separated. All recipients get one combined email per check.</p>
        </div>
        <div>
          <label htmlFor="cc_recipients" className="mb-1 block text-sm font-medium">CC recipients</label>
          <textarea id="cc_recipients" name="cc_recipients" rows={2} defaultValue={settings.cc_recipients.join(", ")} className={input}
            placeholder="name@example.com, other@example.com" />
          <p className="mt-1 text-xs text-gray-500">Comma-separated. Copied (CC) on every alert email and test email.</p>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="email_enabled" defaultChecked={settings.email_enabled} className="h-4 w-4" />
            Send alert emails
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="push_enabled" defaultChecked={settings.push_enabled} className="h-4 w-4" />
            Send push notifications
          </label>
        </div>
        {state.error && <p role="alert" className="text-sm font-medium text-critical">Error: {state.error}</p>}
        {state.ok && <p role="status" className="text-sm font-medium text-ok">{state.ok}</p>}
        <button className={btn.primary} disabled={pending}>{pending ? "Saving..." : "Save settings"}</button>
      </Card>
    </form>
  );
}
