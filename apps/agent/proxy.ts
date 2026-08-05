import { NextRequest, NextResponse } from "next/server"
import { agentSessionCookie } from "@/lib/agent-session"

/**
 * Top-level authenticated agent workspace paths. The `(workspace)` route group
 * does not change URLs, so each real path must be listed here and in
 * `config.matcher`. Phase 2 pages do not exist yet — the matcher still protects
 * them so unauthenticated requests redirect to /login rather than proceeding.
 */
const workspacePaths = [
  "/dashboard",
  "/my-store",
  "/sales",
  "/pricing",
  "/wallet",
  "/withdrawals",
  "/settings",
]

function isWorkspacePath(pathname: string): boolean {
  return workspacePaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(agentSessionCookie)

  if (isWorkspacePath(request.nextUrl.pathname) && !hasSession) {
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
  matcher: [
    "/dashboard/:path*",
    "/my-store/:path*",
    "/sales/:path*",
    "/pricing/:path*",
    "/wallet/:path*",
    "/withdrawals/:path*",
    "/settings/:path*",
    "/login",
    "/register",
  ],
}
