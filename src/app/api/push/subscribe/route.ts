import { NextResponse, type NextRequest } from "next/server";
import { deleteSubscription, saveSubscription } from "@/lib/push";

/** Save this device's push subscription. Login is enforced by middleware. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  if (typeof sub?.endpoint !== "string" || !sub.endpoint.startsWith("https://") ||
      typeof sub?.keys?.p256dh !== "string" || typeof sub?.keys?.auth !== "string") {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  const label = typeof body.deviceLabel === "string" ? body.deviceLabel.slice(0, 80) : null;
  await saveSubscription(sub, req.headers.get("user-agent"), label);
  return NextResponse.json({ ok: true });
}

/** Remove this device (used when the user turns alerts off on it). */
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  await deleteSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
