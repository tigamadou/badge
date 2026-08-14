import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PREFIXES = ["/org", "/event", "/platform", "/profile"];
const STAFF_ONLY_PREFIXES = ["/platform"];
const API_PROTECTED_PREFIXES = ["/api/org", "/api/platform", "/api/profile"];
const API_STAFF_ONLY_PREFIXES = ["/api/platform"];

function pathStartsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtectedPage = pathStartsWithAny(pathname, PROTECTED_PREFIXES);
  const isProtectedApi = pathStartsWithAny(pathname, API_PROTECTED_PREFIXES);
  if (!isProtectedPage && !isProtectedApi) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    if (isProtectedApi) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isStaffArea =
    pathStartsWithAny(pathname, STAFF_ONLY_PREFIXES) ||
    pathStartsWithAny(pathname, API_STAFF_ONLY_PREFIXES);

  if (isStaffArea && !token.isStaff) {
    if (isProtectedApi) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Propage le pathname en header de requete : les Server Components n'ont pas
  // d'API native pour le lire, et le layout org en a besoin pour laisser passer
  // l'onglet /subscription quand l'abonnement est inactif.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/org/:path*",
    "/event/:path*",
    "/platform/:path*",
    "/profile/:path*",
    "/api/org/:path*",
    "/api/platform/:path*",
    "/api/profile/:path*",
  ],
};
