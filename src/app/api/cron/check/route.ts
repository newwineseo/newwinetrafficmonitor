import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { runCheck } from "@/lib/check";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Called daily by Vercel Cron, which sends "Authorization: Bearer ${CRON_SECRET}". */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { log, ...summary } = await runCheck("cron");
  return NextResponse.json(summary, { status: summary.status === "failed" ? 500 : 200 });
}
