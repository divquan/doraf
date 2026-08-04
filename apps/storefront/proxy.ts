import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || ""
  const { pathname } = request.nextUrl

  // Handle legacy /buy/:webSalesId paths -> 301 Redirect to subdomain or rewrite
  if (pathname.startsWith("/buy/")) {
    const parts = pathname.split("/").filter(Boolean)
    const identifier = parts[1]
    if (identifier) {
      const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "doraf.app"
      const portMatch = host.match(/:\d+$/)
      const port = portMatch ? portMatch[0] : ""
      const redirectUrl = new URL(
        `http${request.nextUrl.protocol === "https:" ? "s" : ""}://${identifier}.${rootDomain.split(":")[0]}${port}/`
      )
      return NextResponse.redirect(redirectUrl, { status: 301 })
    }
  }

  // Extract subdomain if accessing via {slug}.doraf.app or {slug}.localhost:3000
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "doraf.app"
  const hostWithoutPort = host.split(":")[0] ?? ""

  let subdomain: string | null = null
  if (
    hostWithoutPort.endsWith(`.${rootDomain}`) &&
    hostWithoutPort !== rootDomain
  ) {
    subdomain = hostWithoutPort.replace(`.${rootDomain}`, "")
  } else if (
    hostWithoutPort.endsWith(".localhost") ||
    (hostWithoutPort.includes("localhost") && hostWithoutPort !== "localhost")
  ) {
    const parts = hostWithoutPort.split(".")
    if (parts.length > 1 && parts[0] !== "localhost" && parts[0] !== "www") {
      subdomain = parts[0] ?? null
    }
  }

  const reserved = new Set(["www", "app", "api", "admin", "dashboard", "recover"])

  if (subdomain && !reserved.has(subdomain)) {
    const rewriteUrl = request.nextUrl.clone()
    if (pathname === "/") {
      rewriteUrl.pathname = `/s/${subdomain}`
    } else {
      rewriteUrl.pathname = `/s/${subdomain}${pathname}`
    }
    return NextResponse.rewrite(rewriteUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
}
