import { NextRequest, NextResponse } from "next/server";

/* ==========================================================================
   Password gate
   Locks the whole app behind a single shared password, checked with HTTP
   Basic Auth. The password itself lives only in the SITE_PASSWORD
   environment variable — set in hPanel → this Web App → Environment
   variables, never committed here. If SITE_PASSWORD isn't set, the gate is
   a no-op (nothing to compare against), so a fresh deploy never accidentally
   locks everyone out.
   ========================================================================== */

const REALM = "Research Analysis";

function suppliedPassword(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Basic ")) return null;
  const encoded = authHeader.slice("Basic ".length);
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return null;
  }
  // Basic Auth sends "username:password" — the username is ignored, only
  // the password after the first colon matters.
  const separator = decoded.indexOf(":");
  return separator === -1 ? decoded : decoded.slice(separator + 1);
}

export function middleware(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  if (suppliedPassword(request.headers.get("authorization")) === password) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${REALM}"` },
  });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
