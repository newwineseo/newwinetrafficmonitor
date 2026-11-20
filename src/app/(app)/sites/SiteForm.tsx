"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { METRICS, type Site } from "@/db/schema";
import { btn, Card, input } from "@/components/ui";
import { METRIC_LABEL } from "@/lib/format";
import type { FormState } from "../actions";

export function SiteForm({ action, site, timezones, defaults }: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  site?: Site;
  timezones: string[];
  defaults: { threshold: number; minBaseline: number };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const metrics = site?.metrics ?? [...METRICS];

  // With JavaScript loaded, submit manually so React does not reset the fields after the action
  // (keeps input on errors). Without it, the form action still posts normally.
  return (
    <form action={formAction} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => formAction(fd)); }}>
      <Card className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Name" htmlFor="name">
            <input id="name" name="name" required defaultValue={site?.name} className={input} />
          </Field>
          <Field label="Domain" htmlFor="domain" hint="For example example.com">
            <input id="domain" name="domain" required defaultValue={site?.domain} className={input} />
          </Field>
          <Field label="GSC property" htmlFor="gscProperty" hint="sc-domain:example.com or https://www.example.com/">
            <input id="gscProperty" name="gscProperty" defaultValue={site?.gscProperty ?? ""} className={input} />
          </Field>
          <Field label="GA4 property ID" htmlFor="ga4PropertyId" hint="Numbers only, for example 123456789">
            <input id="ga4PropertyId" name="ga4PropertyId" defaultValue={site?.ga4PropertyId ?? ""} className={input} />
          </Field>
          <Field label="Time zone" htmlFor="timezone" hint="Use the GA4 property's time zone">
            <select id="timezone" name="timezone" defaultValue={site?.timezone ?? "Asia/Kolkata"} className={input}>
              {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Threshold %" htmlFor="thresholdPct" hint={`Blank = default (${defaults.threshold})`}>
              <input id="thresholdPct" name="thresholdPct" type="number" min={1} max={95} step="any"
                defaultValue={site?.thresholdPct ?? ""} className={input} />
            </Field>
            <Field label="Min average" htmlFor="minBaseline" hint={`Blank = default (${defaults.minBaseline})`}>
              <input id="minBaseline" name="minBaseline" type="number" min={0} step="any"
                defaultValue={site?.minBaseline ?? ""} className={input} />
            </Field>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-medium">Metrics to check</legend>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {METRICS.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={`metric_${m}`} defaultChecked={metrics.includes(m)} className="h-4 w-4" />
                {METRIC_LABEL[m]}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="Extra recipients" htmlFor="extraRecipients" hint="Comma-separated. Added to the team list for this site's alerts.">
          <input id="extraRecipients" name="extraRecipients" defaultValue={site?.extraRecipients.join(", ") ?? ""} className={input} />
        </Field>

        {state.error && <p role="alert" className="text-sm font-medium text-critical">Error: {state.error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button className={btn.primary} disabled={pending}>
            {pending ? (site ? "Saving..." : "Adding and loading 90 days...") : site ? "Save changes" : "Add site"}
          </button>
          <Link href={site ? `/sites/${site.id}` : "/sites"} className="text-sm text-brand underline">Cancel</Link>
        </div>
      </Card>
    </form>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
