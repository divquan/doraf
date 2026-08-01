import { NextRequest, NextResponse } from "next/server"

const sessionCookieName = "doraf_internal_session"
const protectedPaths = ["/dashboard", "/inventory"]

export function proxy(request: NextRequest) {
  if (
    protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path)) &&
    !request.cookies.get(sessionCookieName)
  ) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ["/dashboard/:path*", "/inventory/:path*"] }
