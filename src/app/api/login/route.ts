import { NextResponse, type NextRequest } from "next/server";
import { checkPassword, clearFailures, createSessionToken, isRateLimited, recordFailure, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  if (!(await checkPassword(password))) {
    recordFailure(ip);
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  clearFailures(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
