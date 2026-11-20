import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Paths that work without logging in. The cron route checks its own bearer token.
const PUBLIC = [/^\/login$/, /^\/api\/login$/, /^\/api\/cron\//];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();
  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals and public static files (service worker, manifest, icons, sound).
  matcher: ["/((?!_next/|favicon.ico|sw.js|manifest.webmanifest|icons/|alert.mp3).*)"],
};
