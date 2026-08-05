import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Script from "next/script"
import { StorefrontLandingView } from "@/components/storefront-landing-view"
import { type StorefrontProduct } from "@/components/storefront-checkout"
import { ApiError, apiJson, apiRequest } from "@/lib/agent-api"

interface Storefront {
  channel: {
    type: "WEB"
    publicId: string
    slug?: string
    webSalesId: string
  }
  agent: {
    displayName: string
    storeName: string
    tagline?: string | null
    logoUrl?: string | null
    bannerUrl?: string | null
    whatsappNumber?: string | null
    themePreset?: string | null
    announcement?: string | null
    subdomainUrl?: string
  }
  products: StorefrontProduct[]
}

async function resolveStorefront(identifier: string): Promise<Storefront> {
  const response = await apiRequest(
    `/sales-channels/web/${encodeURIComponent(identifier)}`
  )
  return (await apiJson(response)) as Storefront
}

export async function generateMetadata(
  props: PageProps<"/s/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params
  let storefront: Storefront | null
  try {
    storefront = await resolveStorefront(slug)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        title: "Doraf store",
        description: "Buy WAEC and BECE result checkers securely on Doraf.",
        robots: { index: false, follow: true },
      }
    }
    throw error
  }

  const name = storefront.agent.storeName || storefront.agent.displayName
  const title = `Buy WAEC checkers from ${name}`
  const description =
    storefront.agent.tagline ||
    `Buy WAEC and BECE result checkers securely from ${name} on Doraf. Pay with Mobile Money and receive your serial and PIN by SMS.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: storefront.agent.logoUrl ? [storefront.agent.logoUrl] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: storefront.agent.logoUrl ? [storefront.agent.logoUrl] : [],
    },
    alternates: {
      canonical: storefront.agent.subdomainUrl,
    },
    robots: { index: false, follow: true },
  }
}

export default async function SubdomainStorefrontPage(
  props: PageProps<"/s/[slug]">
) {
  const { slug } = await props.params
  let storefront: Storefront
  try {
    storefront = await resolveStorefront(slug)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  return (
    <>
      <Script
        src="https://js.paystack.co/v2/inline.js"
        strategy="afterInteractive"
      />
      <StorefrontLandingView
        agent={storefront.agent}
        webSalesId={storefront.channel.publicId}
        products={storefront.products}
      />
    </>
  )
}
