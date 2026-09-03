export function getStorefrontConfig(storefrontUrl?: string) {
  // Explicit environment wins over the API-provided URL: the API deployment
  // may not know the public storefront domain (localhost fallback), while the
  // portal env does. NEXT_PUBLIC_ comes first because it is the only form
  // inlined into client ("use client") bundles; the bare name only exists
  // server-side. Both must be set appropriately at build time for Vercel.
  const rawUrl =
    process.env.NEXT_PUBLIC_DASHCHECKER_STOREFRONT_URL ||
    process.env.DASHCHECKER_STOREFRONT_URL ||
    storefrontUrl ||
    "http://localhost:3003"

  try {
    const url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`)
    const protocol = url.protocol || "https:"
    const hostname = url.hostname
    const port = url.port ? `:${url.port}` : ""

    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".localhost")

    const rootDomain = isLocal
      ? "localhost"
      : hostname.split(".").slice(-2).join(".") || hostname

    const rootHostWithPort = isLocal ? `localhost${port}` : rootDomain

    return {
      protocol,
      rootDomain,
      port,
      suffix: `.${rootHostWithPort}`,
      formatSubdomainUrl: (slug: string) => {
        if (!slug) return rawUrl
        const cleanSlug = slug.trim()
        if (isLocal) {
          return `${protocol}//${cleanSlug}.localhost${port}`
        }
        return `${protocol}//${cleanSlug}.${rootDomain}`
      },
    }
  } catch {
    return {
      protocol: "https:",
      rootDomain: "dashchecker.app",
      port: "",
      suffix: ".dashchecker.app",
      formatSubdomainUrl: (slug: string) => `https://${slug.trim()}.dashchecker.app`,
    }
  }
}
