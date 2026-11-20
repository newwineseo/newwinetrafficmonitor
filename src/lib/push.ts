import { eq, inArray } from "drizzle-orm";
import * as webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

export interface PushPayload { title: string; body: string; url: string }

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:newwineseo@gmail.com", pub, priv);
  configured = true;
  return true;
}

/** Send one notification to every saved device. Devices whose subscription is gone (404/410) are deleted. */
export async function sendPushToAll(payload: PushPayload) {
  const result = { sent: 0, removed: 0, failed: 0, errors: [] as string[] };
  if (!configure()) {
    result.errors.push("VAPID keys are not set");
    return result;
  }
  const subs = await db().select().from(pushSubscriptions);
  const body = JSON.stringify(payload);
  const gone: number[] = [];
  const ok: number[] = [];

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body,
        { TTL: 24 * 3600, urgency: "high" });
      ok.push(s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.id);
      else {
        result.failed++;
        result.errors.push(`${s.deviceLabel || `device ${s.id}`}: ${code ?? ""} ${(e as Error).message}`.trim());
      }
    }
  }));

  if (gone.length) await db().delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  if (ok.length) await db().update(pushSubscriptions).set({ lastSuccessAt: new Date() }).where(inArray(pushSubscriptions.id, ok));
  result.sent = ok.length;
  result.removed = gone.length;
  return result;
}

export async function saveSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string | null, deviceLabel: string | null) {
  const values = { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent, deviceLabel };
  await db().insert(pushSubscriptions).values(values)
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh: values.p256dh, auth: values.auth, userAgent, deviceLabel } });
}

export async function deleteSubscription(endpoint: string) {
  await db().delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
