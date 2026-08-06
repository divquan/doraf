import { NextRequest, NextResponse } from "next/server"

const sessionCookieName = "doraf_internal_session"
const workspacePaths = [
  "/dashboard",
  "/inventory",
  "/pricing",
  "/withdrawals",
  "/agents",
  "/operators",
  "/settings",
]

export function proxy(request: NextRequest) {
  if (
    workspacePaths.some((path) => request.nextUrl.pathname.startsWith(path)) &&
    !request.cookies.get(sessionCookieName)
  ) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/inventory/:path*",
    "/pricing/:path*",
    "/withdrawals/:path*",
    "/agents/:path*",
    "/operators/:path*",
    "/settings/:path*",
  ],
}
