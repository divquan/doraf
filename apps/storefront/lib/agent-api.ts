import "server-only"

import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { agentSessionCookie, registrationCookie } from "@/lib/agent-session"

export { agentSessionCookie, registrationCookie } from "@/lib/agent-session"

function apiBaseUrl() {
  return (process.env.DASHCHECKER_API_URL ?? "http://localhost:3000/v1").replace(
    /\/$/,
    ""
  )
}

export async function apiRequest(
  path: string,
  init: RequestInit = {},
  withSession = false
) {
  const headers = new Headers(init.headers)
  headers.set("content-type", "application/json")
  headers.set("cache-control", "no-store")
  if (withSession) {
    const token = (await cookies()).get(agentSessionCookie)?.value
    if (!token) {
      return Response.json(
        { message: "Authentication required" },
        { status: 401 }
      )
    }
    headers.set("authorization", `Bearer ${token}`)
  }
  return fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })
}

export async function apiJson(response: Response) {
  const body: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? Array.isArray(body.message)
          ? body.message.join(". ")
          : String(body.message)
        : "The request could not be completed"
    throw new ApiError(response.status, message)
  }
  return body
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

export function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...init?.headers, "cache-control": "no-store" },
  })
}

export function setAgentSession(
  response: NextResponse,
  token: string,
  expiresAt: string
) {
  setSecureCookie(response, agentSessionCookie, token, expiresAt)
}

export function setRegistrationSession(
  response: NextResponse,
  token: string,
  expiresAt: string
) {
  setSecureCookie(response, registrationCookie, token, expiresAt)
}

function setSecureCookie(
  response: NextResponse,
  name: string,
  value: string,
  expiresAt: string
) {
  const expires = new Date(expiresAt)
  response.cookies.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: Number.isNaN(expires.getTime()) ? undefined : expires,
  })
}

export function clearCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

export function requireSameOrigin(request: NextRequest) {
  // 1. Check browser's built-in Sec-Fetch-Site header
  const secFetchSite = request.headers.get("sec-fetch-site")
  if (secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none") {
    return
  }

  const origin = request.headers.get("origin")
  if (!origin) return

  try {
    const originUrl = new URL(origin)
    const hostHeader = request.headers.get("host") || request.nextUrl.host || ""
    const requestHostWithoutPort = hostHeader.split(":")[0]?.toLowerCase() || ""
    const originHostWithoutPort = originUrl.hostname.toLowerCase()

    // 2. Direct host match (e.g. new.localhost === new.localhost)
    if (originHostWithoutPort === requestHostWithoutPort) return

    // 3. Direct origin match with request.nextUrl.origin
    if (origin === request.nextUrl.origin) return

    // 4. Localhost / dev server subdomains match
    const isLocalOrigin =
      originHostWithoutPort === "localhost" ||
      originHostWithoutPort === "127.0.0.1" ||
      originHostWithoutPort === "::1" ||
      originHostWithoutPort.endsWith(".localhost")

    const isLocalHost =
      requestHostWithoutPort === "localhost" ||
      requestHostWithoutPort === "127.0.0.1" ||
      requestHostWithoutPort === "::1" ||
      requestHostWithoutPort.endsWith(".localhost")

    if (isLocalOrigin && isLocalHost) return

    // 5. Same root domain match (e.g. *.dashchecker.app)
    const storefrontUrl = process.env.DASHCHECKER_STOREFRONT_URL
    if (storefrontUrl) {
      const parsedStorefront = new URL(
        storefrontUrl.startsWith("http") ? storefrontUrl : `https://${storefrontUrl}`
      )
      const rootDomain = parsedStorefront.hostname.replace(/^www\./, "").toLowerCase()
      if (
        (originHostWithoutPort === rootDomain || originHostWithoutPort.endsWith(`.${rootDomain}`)) &&
        (requestHostWithoutPort === rootDomain || requestHostWithoutPort.endsWith(`.${rootDomain}`))
      ) {
        return
      }
    }
  } catch {
    // If URL parsing fails, fall through
  }

  if (secFetchSite === "cross-site") {
    throw new ApiError(403, "Cross-site requests are not allowed")
  }
}

export function routeError(error: unknown, fallback: string) {
  return noStoreJson(
    { message: error instanceof Error ? error.message : fallback },
    { status: error instanceof ApiError ? error.status : 500 }
  )
}
