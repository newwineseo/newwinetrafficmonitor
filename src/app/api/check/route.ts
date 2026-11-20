import { NextResponse } from "next/server";
import { runCheck } from "@/lib/check";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** "Run check now" button. Login is enforced by middleware. */
export async function POST() {
  const result = await runCheck("manual");
  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
