import "server-only"

import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const sessionCookieName = "doraf_internal_session"

function apiBaseUrl() {
  return (process.env.DORAF_API_URL ?? "http://localhost:3000/v1").replace(
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
    const token = (await cookies()).get(sessionCookieName)?.value
    if (!token) {
      return new Response(
        JSON.stringify({ message: "Authentication required" }),
        {
          status: 401,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        }
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
        ? String(body.message)
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

export function setSession(
  response: NextResponse,
  token: string,
  expiresAt: string
) {
  const expires = new Date(expiresAt)
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: Number.isNaN(expires.getTime()) ? undefined : expires,
  })
}

export function clearSession(response: NextResponse) {
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (origin && origin !== request.nextUrl.origin) {
    throw new ApiError(403, "Cross-site requests are not allowed")
  }
}

export function routeError(error: unknown, fallback: string) {
  return noStoreJson(
    { message: error instanceof Error ? error.message : fallback },
    { status: error instanceof ApiError ? error.status : 500 }
  )
}
