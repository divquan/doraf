import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

function getRootDomain(hostHeader: string): string {
  const storefrontUrl = process.env.DASHCHECKER_STOREFRONT_URL
  if (storefrontUrl) {
    try {
      const parsed = new URL(
        storefrontUrl.startsWith("http")
          ? storefrontUrl
          : `https://${storefrontUrl}`
      )
      return parsed.hostname
    } catch {
      // Ignore parse error
    }
  }
  const hostWithoutPort = hostHeader.split(":")[0] || ""
  if (hostWithoutPort.endsWith(".localhost")) return "localhost"
  const parts = hostWithoutPort.split(".")
  if (parts.length >= 2) return parts.slice(-2).join(".")
  return hostWithoutPort || "localhost"
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || ""
  const { pathname } = request.nextUrl
  const rootDomain = getRootDomain(host)

  // Handle legacy /buy/:webSalesId paths -> 301 Redirect to subdomain
  if (pathname.startsWith("/buy/")) {
    const parts = pathname.split("/").filter(Boolean)
    const identifier = parts[1]
    if (identifier) {
      const portMatch = host.match(/:\d+$/)
      const port = portMatch ? portMatch[0] : ""
      const isLocal = rootDomain === "localhost" || rootDomain === "127.0.0.1"
      const targetHost = isLocal
        ? `${identifier}.localhost${port}`
        : `${identifier}.${rootDomain}`
      const redirectUrl = new URL(
        `http${request.nextUrl.protocol === "https:" ? "s" : ""}://${targetHost}/`
      )
      return NextResponse.redirect(redirectUrl, { status: 301 })
    }
  }

  // Extract subdomain if accessing via {slug}.domain or {slug}.localhost:3003
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

  const reserved = new Set([
    "www",
    "app",
    "api",
    "admin",
    "dashboard",
    "recover",
  ])

  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  // Skip proxying/rewriting for static assets (files with extensions)
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(pathname)
  if (hasExtension) {
    return NextResponse.next()
  }

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
  matcher: ["/((?!_next/static|_next/image|favicon|robots.txt|logo).*)"],
}
