import { NextRequest, NextResponse } from "next/server"
import { agentSessionCookie } from "@/lib/agent-session"

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(agentSessionCookie)
  if (request.nextUrl.pathname.startsWith("/dashboard") && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  if (
    hasSession &&
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/register")
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
}
