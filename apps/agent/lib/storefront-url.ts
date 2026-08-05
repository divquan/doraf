export function getStorefrontConfig(storefrontUrl?: string) {
  const rawUrl =
    storefrontUrl ||
    process.env.DORAF_STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_DORAF_STOREFRONT_URL ||
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
      rootDomain: "doraf.app",
      port: "",
      suffix: ".doraf.app",
      formatSubdomainUrl: (slug: string) => `https://${slug.trim()}.doraf.app`,
    }
  }
}
