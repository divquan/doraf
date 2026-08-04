import type { MetadataRoute } from "next"

// Storefront robots policy. Buyer store pages (/buy/*) are agent-specific and
// must not be indexed (agent privacy and to avoid enumerating identifiers). The
// public recovery page (/recover) may be indexed so buyers can find it. The API
// routes under /api are disallowed as they are not crawlable documents.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.DORAF_STOREFRONT_URL
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/recover",
        disallow: ["/buy/", "/api/"],
      },
    ],
    sitemap: baseUrl ? `${baseUrl.replace(/\/$/, "")}/sitemap.xml` : undefined,
  }
}
