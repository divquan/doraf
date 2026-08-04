import { ImageResponse } from "next/og"
import { ApiError, apiJson, apiRequest } from "@/lib/agent-api"

export const alt = "Doraf agent store — buy WAEC result checkers"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

interface Storefront {
  agent: { displayName: string }
}

// Generate a branded open graph image per store, using the agent's registered
// name only (no agent-uploaded branding). This keeps share previews useful on
// WhatsApp — the primary distribution channel — without expanding MVP scope
// into custom branding. Unknown or suspended identifiers render a generic card
// so existence is not leaked.
export default async function OpengraphImage(
  props: PageProps<"/buy/[webSalesId]">
) {
  const { webSalesId } = await props.params
  let name = "a Doraf agent"
  try {
    const response = await apiRequest(
      `/sales-channels/web/${encodeURIComponent(webSalesId)}`
    )
    const storefront = (await apiJson(response)) as Storefront
    name = storefront.agent.displayName
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0b1220",
        color: "#f8fafc",
        padding: "64px 72px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            borderRadius: 18,
            border: "3px solid #f8fafc",
            fontSize: 40,
            fontWeight: 800,
          }}
        >
          A+
        </div>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>
          dash<span style={{ color: "#D96B27" }}>checker</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 30, color: "#94a3b8" }}>Buying from</div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.05,
            maxWidth: 1000,
          }}
        >
          {name}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: "#cbd5e1" }}>
          WAEC &amp; BECE result checkers · Mobile Money · SMS delivery
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: "#D96B27",
            fontWeight: 700,
          }}
        >
          Secure checkout
        </div>
      </div>
    </div>,
    { ...size }
  )
}
