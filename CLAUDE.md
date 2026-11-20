# NewWine Traffic Monitor — Build Brief

Daily traffic-drop monitoring for NewWine's client websites. Checks Google Search Console (GSC) and GA4 once a day. When traffic drops past a threshold it raises an alert in:
1. the **dashboard** (desktop web tool),
2. the **installable web app** on phones (PWA), as a **push notification**, plus an alert sound when the app is open,
3. **email** (sent from newwineseo@gmail.com via Gmail SMTP).

Start with **2 sites**, built so it scales to 30+ without code changes.

---

## Stack (do not change without asking)
- **Next.js 15** (App Router) + **TypeScript**, deployed on **Vercel Hobby** from GitHub (`main` branch auto-deploys).
- **Neon Postgres** (`DATABASE_URL`) with **Drizzle ORM** and migrations.
- **Email via Gmail SMTP** using `nodemailer` (host `smtp.gmail.com`, port 465, secure) from `newwineseo@gmail.com` with a Google **App Password**. Put the sender behind one small `sendEmail()` interface with an `EMAIL_PROVIDER` switch (`gmail` now, `resend` later) so changing provider needs no other code changes.
- **Web Push** with VAPID keys (`web-push` npm package) + a service worker for mobile and desktop notifications.
- **Vercel Cron**: `30 3 * * *` (09:00 IST) calls `GET /api/cron/check`.
- Charts: lightweight SVG or Recharts. No heavy UI kits. Tailwind is fine.

## Style
- Colors: navy `#0D1B2A` (top bar, headers), blue `#1B4F72`, accent `#2E86C1`.
- Status colors: critical `#C0392B`, warning `#B9770E`, ok `#1E8449`. Always show a text label with each color, never color alone.
- **No emojis anywhere** (UI, emails, notifications, code comments).
- Mobile-first layouts. Every page must work at 380px wide.

---

## Data sources
Auth with a Google **service account**. The key JSON is in env var `GOOGLE_SERVICE_ACCOUNT_JSON`. Use read-only scopes only: `webmasters.readonly`, `analytics.readonly`.

| Metric key | Source | API call | Day evaluated |
|---|---|---|---|
| `gsc_clicks` | GSC | `searchanalytics.query`, dimension `date`, type `web` | Newest date GSC returns (usually 2–3 days ago) |
| `gsc_impressions` | GSC | same call | same |
| `ga4_sessions` | GA4 Data API | `runReport`, dimensions `date` + `sessionDefaultChannelGroup`, metric `sessions` | Yesterday, in the **site's time zone** |
| `ga4_organic` | GA4 | same call, filtered to `Organic Search` | same |

- **Zero-filling:** GA4 omits days with no data, so fill missing dates in the requested range with **0**. A zero is meaningful: it usually means the tracking tag broke.
- **Stale GSC data:** if GSC's newest date is older than 6 days, treat it as a **data connection problem** (likely lost access).
- **Discovery:** use the GSC `sites.list` API and the GA4 Admin `accountSummaries.list` API to populate dropdowns in the Add Site form.

## Drop detection (core logic, cover it with unit tests)
For each active site and each enabled metric:
- `baseline` = average of the 7 days before the evaluated day. Skip the metric if fewer than 5 of those days have data.
- `drop_pct` = `(baseline - value) / baseline * 100`.
- **Skip** (status `low-volume`) if `baseline < min_baseline`. Default minimum is 20; each site can override it.
- **Warning** if `drop_pct >= threshold`. Default threshold is 25%; each site can override it.
- **Critical** if `drop_pct >= 2 × threshold`, or if `value == 0` while `baseline > 0`.
- At most **one alert per (site, metric, date)**: enforce with a unique constraint so re-runs are safe.
- **Auto-resolve:** when a later check finds the metric back within threshold, set its open or acknowledged alerts to `resolved`.

## Database tables
- `sites`: name, domain, gsc_property, ga4_property_id, timezone, threshold_pct (nullable), min_baseline (nullable), metrics (array), extra_recipients, active, last_fetch_at, last_error.
- `daily_metrics`: site_id, metric, date, value. Primary key (site_id, metric, date).
- `alerts`: site_id, metric, date, value, baseline, drop_pct, threshold_pct, severity, status (`open` / `acknowledged` / `resolved`), created_at, emailed_at, pushed_at, acknowledged_at, resolved_at. Unique (site_id, metric, date).
- `push_subscriptions`: endpoint (unique), p256dh, auth, user_agent, device_label, created_at, last_success_at.
- `runs`: trigger (`cron` / `manual`), started_at, finished_at, status, sites_checked, alerts_created, emails_sent, pushes_sent, log.
- `settings`: key/value pairs: default_threshold, min_baseline, recipients, email_enabled, push_enabled, ga4_lag_days.

## Daily check — `GET /api/cron/check`
1. Reject the request unless the header is `Authorization: Bearer ${CRON_SECRET}`.
2. Fetch **all active sites in parallel** (`Promise.allSettled`), the last 16 days each. Upsert into `daily_metrics`. The whole run must finish well under 60 seconds.
3. Evaluate each site, insert new alerts and auto-resolve recovered ones.
4. Notify only on **new** alerts, plus **new** data errors (an error text that differs from the site's previous `last_error`):
   - **One combined email per run.** Critical alerts first, then warnings, then a "Data connection problems" section. Include a button linking to the dashboard.
   - **One push notification per run** to every subscription.
     - Title: `Traffic drop: <Site>` when there is 1 alert, or `<N> traffic drops on <M> sites` when there are several.
     - Body: the worst drop, e.g. `GA4 sessions down 100% (0 vs avg 225)`.
     - Tap opens `/alerts`.
     - Delete subscriptions that return 404 or 410.
5. Write the result to `runs`.
6. `POST /api/check` (login required) runs the same check from a "Run check now" button.

## Dashboard and web app (same Next.js app)
- **Login:** single shared password (`ADMIN_PASSWORD`). Signed HttpOnly cookie, valid 30 days. Rate-limit login attempts.
- **Overview:**
  - Tiles: sites monitored, open alerts (and how many are critical), sites with data errors, last check time.
  - Site table: status pill; latest value vs 7-day average with % change for GSC clicks and GA4 sessions; 30-day sparklines; open-alert count.
  - Red banner if the last successful run is more than 26 hours old ("Daily check did not run").
- **Site detail:**
  - Current status per metric.
  - 90-day line chart for each metric, with a dashed line for the 7-day average and red dots on alert days. Hover or tap shows a tooltip.
  - Alert history for the site.
- **Alerts:** filter tabs Open / Acknowledged / Resolved / All. Acknowledge button on each alert, plus "Acknowledge all".
- **Sites:**
  - Add, edit, pause and delete sites.
  - Add form: dropdowns from discovery, time zone, threshold, min average, metric checkboxes, extra recipients.
  - On add, backfill 90 days.
- **Settings:**
  - Default threshold, min average, team recipients, email on/off, push on/off.
  - Buttons: "Send test email" and "Send test notification".
  - Device list (push subscriptions) with remove.
- **Run history:** the last 60 runs and their logs.

## PWA + mobile alerts
- `manifest.webmanifest`:
  - name "NewWine Traffic Monitor", short_name "NW Monitor"
  - theme color `#0D1B2A`, display `standalone`
  - icons at 192 and 512 px, plus maskable versions (generate simple navy icons with the letters "NW")
- `public/sw.js`:
  - Handles `push`: `showNotification` with title, body, icon, badge, `tag: 'nw-alert'`, `renotify: true`, `requireInteraction: true` (where supported), `vibrate: [200,100,200,100,400]`, and `data.url`.
  - Handles `notificationclick`: focus an open app window, or open `data.url`.
- **"Enable alerts on this device" button** (Settings page and a dismissible banner):
  - Requests notification permission, subscribes with `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, and POSTs the subscription to `/api/push/subscribe`.
  - On iPhone when not installed (iOS Safari, not standalone): show "Add to Home Screen first" instructions instead (Share > Add to Home Screen, then open from the icon).
- **In-app alert sound:**
  - While the app is open, poll `/api/alerts/summary` every 60 seconds. When a new alert appears, play `public/alert.mp3` (a short two-tone alarm, about 2 seconds), show a red toast, and update the badge count.
  - Browsers block sound until the user has interacted with the page, so unlock audio on the first tap anywhere.
  - Sound on/off toggle in Settings (store it in localStorage, wrapped in try/catch).
- **Badge:** use the App Badging API (`navigator.setAppBadge`) where supported, set to the open alert count.
- Known limits to document in the README:
  - With the app closed, the phone plays its default notification sound. A custom sound is only possible while the app is open.
  - iPhone push needs iOS 16.4+ and the app added to the Home Screen.

## Demo mode (build and test before Google access exists)
- `DEMO_MODE=1` seeds 4 demo sites with synthetic, deterministic data (weekday pattern plus noise):
  1. **Steady:** no alerts.
  2. **GSC drop:** about 48% clicks drop in the last 2 days, so a warning.
  3. **Tracking break:** GA4 is 0 yesterday, so critical.
  4. **Small site:** baseline under 20, so low-volume and skipped.
- The demo fetcher replaces the Google calls for any site whose property string starts with `demo:`.
- All flows must work in demo mode: alerts, email (log to console if `GMAIL_APP_PASSWORD` is empty), push, sound, charts.

## Environment variables
```
DATABASE_URL=                 # from Neon
GOOGLE_SERVICE_ACCOUNT_JSON=  # full JSON key on one line (add when access is ready)
EMAIL_PROVIDER=gmail          # gmail | resend (later)
GMAIL_USER=newwineseo@gmail.com
GMAIL_APP_PASSWORD=           # 16-char Google App Password, no spaces
EMAIL_FROM_NAME=NewWine Traffic Monitor
RESEND_API_KEY=               # only if EMAIL_PROVIDER=resend
ALERT_RECIPIENTS=             # comma-separated
ADMIN_PASSWORD=
SESSION_SECRET=               # openssl rand -hex 32
CRON_SECRET=                  # random string; Vercel sends it to the cron route
NEXT_PUBLIC_VAPID_PUBLIC_KEY= # npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@yourdomain.com
APP_URL=                      # https://<project>.vercel.app
DEMO_MODE=1                   # set to 0 once real sites are added
```
Never commit `.env*` files, the service account JSON or the Gmail app password. Add them to `.gitignore`.

## Email notes (Gmail SMTP)
- From header: `"NewWine Traffic Monitor" <newwineseo@gmail.com>`. Gmail rewrites any other From address, so do not try to send as another address.
- Gmail allows roughly 500 messages a day. The tool sends one digest per run, so this is never an issue; still send one email with all recipients in To/Bcc rather than one per recipient.
- Use plain-text + HTML (multipart). Inline CSS only, table layout, max width 640px, so it renders in Gmail and Outlook.
- If sending fails (for example the app password was revoked), record it in the run log and show a red banner in Settings: "Email sending failed: check GMAIL_APP_PASSWORD".

---

## Build phases (finish and verify each one before starting the next)
1. **Foundation:** Next.js app, Drizzle schema + migrations, login, demo mode, the drop-detection module with unit tests, and the cron route. Verify: calling the cron route locally creates the expected demo alerts, and running it again creates no duplicates.
2. **Dashboard:** Overview, Site detail with charts, Alerts, Sites, Settings, Run history. Verify at 1280px and at 380px.
3. **Notifications:** Gmail SMTP email digest (nodemailer), PWA manifest + service worker, web push subscribe/send, in-app sound + toast + badge, test buttons. Verify a test push arrives on an Android phone and on an iPhone with the app installed to the Home Screen.
4. **Real data:** Google service-account auth, the GSC and GA4 fetchers, property discovery, 90-day backfill on add. Verify the numbers match the GSC Performance report and GA4 Acquisition reports exactly for the 2 test sites.
5. **Optional, later:** a loud custom alarm even when the phone is locked, via **ntfy** (free) or **Pushover**. Send a high-priority message alongside web push when the run has critical alerts.

## Go-live checklist
- [ ] Repo pushed to GitHub and imported into Vercel. Neon added via Vercel Storage.
- [ ] All env vars set in Vercel. Redeployed.
- [ ] `vercel.json` cron is visible in Vercel > Cron Jobs.
- [ ] 2 test sites added, and their numbers match GSC and GA4.
- [ ] Send test email works and lands in the inbox (not spam) for every recipient.
- [ ] Forced alert test: set a site's threshold to 1%, Run check now, then confirm the email, the push notification on a phone, and the sound in the open app. Set the threshold back to 25.
- [ ] Lost-access test: a site without access shows a "could not be checked" error.
- [ ] The next morning, the cron ran between 09:00 and 10:00 IST and appears in Run history.
- [ ] `DEMO_MODE=0`, demo sites deleted.
