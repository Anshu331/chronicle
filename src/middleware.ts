import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "@/lib/auth/auth.config";

const { auth } = NextAuth(authConfig);

const publicPaths = ["/", "/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    publicPaths.includes(pathname) ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session?.user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
