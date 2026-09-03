import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "agent",
  "dashboard",
  "recover",
])

function getRootDomain(hostHeader: string): string {
  const envUrl = process.env.DASHCHECKER_STOREFRONT_URL
  if (envUrl) {
    try {
      const url = new URL(envUrl.startsWith("http") ? envUrl : `https://${envUrl}`)
      return url.hostname
    } catch {
      // fall through to host parsing
    }
  }

  const host = hostHeader.split(":")[0] || ""
  const parts = host.split(".")
  return parts.length >= 2 ? parts.slice(-2).join(".") : host || "localhost"
}

function getSubdomain(hostHeader: string, rootDomain: string): string | null {
  const host = hostHeader.split(":")[0] ?? ""
  if (!host || host === rootDomain) return null
  if (host.endsWith(`.${rootDomain}`)) {
    return host.replace(`.${rootDomain}`, "")
  }
  return null
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || ""

  // 1. Canonicalize path: /// -> /, /foo//bar -> /foo/bar
  const rawPath = request.nextUrl.pathname
  const pathname = rawPath.replace(/\/{2,}/g, "/")
  if (pathname !== rawPath) {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    return NextResponse.redirect(url, 308)
  }

  const rootDomain = getRootDomain(host)

  // 2. Skip API and static assets
  if (pathname.startsWith("/api/")) return NextResponse.next()
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return NextResponse.next()

  // 3. Subdomain rewrite: foo.example.com/ -> /s/foo
  const subdomain = getSubdomain(host, rootDomain)
  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) {
    return NextResponse.next()
  }

  const rewriteUrl = request.nextUrl.clone()
  rewriteUrl.pathname = pathname === "/" ? `/s/${subdomain}` : `/s/${subdomain}${pathname}`
  return NextResponse.rewrite(rewriteUrl)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|robots.txt|logo).*)"],
}
