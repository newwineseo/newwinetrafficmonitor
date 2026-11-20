# NewWine Traffic Monitor

Daily traffic-drop monitoring for NewWine's client websites. Once a day it checks Google Search Console (GSC) and Google Analytics 4 (GA4). When traffic drops past a threshold it raises an alert in:

1. the **dashboard** (desktop web app),
2. the **installable web app** on phones, as a **push notification**, plus an alarm sound while the app is open,
3. **email**, sent from newwineseo@gmail.com.

Built with Next.js 15, TypeScript, Tailwind, Drizzle ORM on Neon Postgres, nodemailer (Gmail SMTP) and web-push. It is hosted on Vercel, and Vercel Cron runs the check at 09:00 IST.

---

## How the check works

For each active site and each enabled metric:

| Metric | Source | Day checked |
|---|---|---|
| GSC clicks, GSC impressions | Search Console, web search | Newest date GSC has (usually 2 to 3 days ago) |
| GA4 sessions, GA4 organic sessions | GA4 Data API (organic = "Organic Search" channel) | Yesterday, in the site's time zone |

- **Baseline:** the average of the 7 days before the day checked. The metric is skipped if fewer than 5 of those days have data.
- **Low volume:** skipped if the baseline is below the minimum average (default 20).
- **Warning:** the drop is at least the threshold (default 25%).
- **Critical:** the drop is at least twice the threshold, or the value is 0 while the baseline is above 0 (usually a broken tracking tag).
- **No duplicates:** there is at most one alert per site, metric and day, enforced by the database, so re-running the check is safe.
- **Auto-resolve:** when a later check finds the metric back within the threshold, its open or acknowledged alerts are resolved.
- **Data problems:** a failed fetch, or GSC data older than 6 days, is a data connection problem. It is shown on the site and included in notifications the first time it appears.
- **Notifications:** only for new alerts and new data problems, as one combined email and one combined push per check.

## Local setup

Requirements: Node 20+ and a Neon Postgres database. ffmpeg is needed only to regenerate the alert sound.

1. Copy `.env.example` to `.env.local` and fill it in (see the table below). For local work, `DEMO_MODE=1` and `DATABASE_URL` are enough.
2. Install packages and create the tables:
   ```
   npm install
   npm run db:migrate
   ```
3. Start the app:
   ```
   npm run dev
   ```
   Then open http://localhost:3000 and sign in with `ADMIN_PASSWORD`.
4. In demo mode, the first check creates 4 demo sites with 90 days of synthetic data. Click **Run check now** on the Overview, or run:
   ```
   npm run check
   ```

### Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally |
| `npm test` | Unit tests (drop detection, demo scenarios, email and push text) |
| `npm run check` | Run the daily check once from the terminal and print the log |
| `npm run db:migrate` | Apply database migrations (also runs automatically on every Vercel deploy) |
| `npm run db:generate` | Create a new migration after changing `src/db/schema.ts` |
| `npm run db:seed-demo -- --reset` | Delete all sites, data, alerts and runs, then recreate the demo sites (`DEMO_MODE=1` only) |
| `npm run assets` | Regenerate the icons and `public/alert.mp3` |

## Environment variables

Set these in `.env.local` locally, and in Vercel under Project > Settings > Environment Variables. Never commit `.env.local`, the service account JSON or the Gmail app password; `.gitignore` already excludes them.

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | Yes | Neon Postgres connection string (the pooled one) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | For real data | The full service account key JSON, on one line. Read-only scopes are used. |
| `EMAIL_PROVIDER` | No | `gmail` (default) or `resend` |
| `GMAIL_USER` | Yes | `newwineseo@gmail.com` |
| `GMAIL_APP_PASSWORD` | Yes | 16-character Google App Password, no spaces. If empty, emails are printed to the server log instead of sent. |
| `EMAIL_FROM_NAME` | No | Sender name, default `NewWine Traffic Monitor` |
| `RESEND_API_KEY` | Only for Resend | Used when `EMAIL_PROVIDER=resend` |
| `ALERT_RECIPIENTS` | Yes | Comma-separated team emails. Used until recipients are saved in Settings; after that, Settings wins. |
| `ADMIN_PASSWORD` | Yes | The shared login password |
| `SESSION_SECRET` | Yes | Random string for signing the login cookie. Generate it with `openssl rand -hex 32`. |
| `CRON_SECRET` | Yes | Random string. Vercel sends it to the cron route as `Authorization: Bearer <CRON_SECRET>`. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Yes | Push public key, from `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Yes | Push private key from the same command |
| `VAPID_SUBJECT` | Yes | `mailto:` address push services can contact, e.g. `mailto:newwineseo@gmail.com` |
| `APP_URL` | Yes | The public address, e.g. `https://<project>.vercel.app`. Used for the "Open dashboard" button in emails. |
| `DEMO_MODE` | No | `1` creates the demo sites on the first check if there are no sites. Set it to `0` once real sites are added. |

If you change the VAPID keys, every device has to enable alerts again.

## Creating the Gmail app password

1. Sign in to newwineseo@gmail.com and open **Google Account > Security**.
2. Turn on **2-Step Verification** if it is not on; app passwords need it.
3. Open **App passwords** (or search for "App passwords" in the account search bar).
4. Create one named `NW Monitor` and copy the 16 characters into `GMAIL_APP_PASSWORD`, without spaces.
5. In the app, go to **Settings > Send test email** and check that it lands in the inbox, not spam.

If the password is revoked, sending fails. The failure is written to the run log, and Settings shows the red banner "Email sending failed: check GMAIL_APP_PASSWORD". Gmail allows about 500 emails a day. The app sends one email per check, with every recipient on that one email.

To switch to Resend later, set `EMAIL_PROVIDER=resend` and `RESEND_API_KEY`. No code changes are needed.

## Adding a site

1. Give the service account read access to the site. Its email is the `client_email` in the key JSON.
   - **Search Console:** Settings > Users and permissions > Add user > Restricted.
   - **GA4:** Admin > Property access management > Add > Viewer.
2. In the app, go to **Sites > Add site**:
   - Pick the GSC property and GA4 property. Once Google access is set up, the lists show everything the service account can see. GSC properties look like `sc-domain:example.com` or `https://www.example.com/`, and GA4 property IDs are numbers only.
   - Set the **time zone** to the GA4 property's time zone.
   - Leave **Threshold** and **Min average** blank to use the defaults from Settings, or set values for this site.
   - Choose the metrics to check. Optionally add extra email recipients for this site.
3. Save. The last 90 days load immediately, so charts and baselines work right away.

Pausing a site stops checks but keeps its history. Deleting it removes its history and alerts.

## Phone alerts

Open the app and go to **Settings > Alerts on this device > Enable alerts on this device**. A banner at the top of the app offers the same button until alerts are enabled. Then use **Send test notification** to confirm it works.

**Android (Chrome):**
1. Open the app address in Chrome and sign in.
2. Optional but recommended: open the menu and choose **Add to Home screen** (or **Install app**).
3. Tap **Enable alerts on this device** and allow notifications.

**iPhone and iPad (iOS 16.4 or later):**
1. Open the app address in **Safari** and sign in.
2. Tap **Share > Add to Home Screen > Add**.
3. Open **NW Monitor** from the new Home Screen icon and sign in again. The installed app keeps its own login.
4. Go to **Settings > Enable alerts on this device** and allow notifications.

**Desktop (Chrome, Edge, Firefox):** open the app, then Settings > Enable alerts on this device.

### Known limits

- **Custom sound only while the app is open.** With the app closed, or the phone locked, the phone plays its default notification sound. The two-tone alarm and the red pop-up appear only while the app is open: it checks for new alerts every 60 seconds.
- **Unlock the sound with a tap.** Browsers block sound until you interact with the page, so tap anywhere once after opening the app.
- **iPhone push needs iOS 16.4 or later and the app added to the Home Screen.** Safari tabs cannot receive push.
- **App badge:** the open-alert count on the app icon works where the browser supports it (installed apps on Chrome, Edge and iOS 16.4+).
- **Vercel Hobby cron timing:** the check runs once a day, at some point within the scheduled hour (09:00 to 10:00 IST).
- **Optional, later:** for a loud alarm even when the phone is locked, add ntfy or Pushover (Phase 5 of the build brief).

## Deployment (Vercel)

- Push to GitHub. Vercel deploys the `main` branch automatically.
- `vercel.json` schedules `GET /api/cron/check` at `30 3 * * *` (09:00 IST). It appears under Project > Settings > Cron Jobs.
- The `vercel-build` script runs the database migrations, then `next build`.
- The check fetches all sites in parallel and normally finishes in under 10 seconds. The route allows up to 60 seconds.

## Project layout

```
src/
  app/(app)/        dashboard pages: overview, sites, alerts, settings, runs
  app/api/          cron check, manual check, login, push subscribe, alert summary, test buttons
  db/               Drizzle schema and Neon client
  lib/detect.ts     drop detection (pure, unit-tested)
  lib/check.ts      the daily check: fetch, store, evaluate, alert, notify, log
  lib/digest.ts     email digest and push text
  lib/email.ts      sendEmail() with the EMAIL_PROVIDER switch
  lib/push.ts       web push sending and subscriptions
  lib/demo.ts       demo data for "demo:" properties
public/
  sw.js             service worker (push and notification click)
  manifest.webmanifest, icons/, alert.mp3
drizzle/            SQL migrations
scripts/            migrate, run check, seed demo, generate assets
```
