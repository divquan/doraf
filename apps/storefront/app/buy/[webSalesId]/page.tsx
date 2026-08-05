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
    storeName?: string
    tagline?: string | null
    logoUrl?: string | null
    bannerUrl?: string | null
    whatsappNumber?: string | null
    themePreset?: string | null
    announcement?: string | null
  }
  products: StorefrontProduct[]
}

async function resolveStorefront(webSalesId: string): Promise<Storefront> {
  const response = await apiRequest(
    `/sales-channels/web/${encodeURIComponent(webSalesId)}`
  )
  return (await apiJson(response)) as Storefront
}

export async function generateMetadata(
  props: PageProps<"/buy/[webSalesId]">
): Promise<Metadata> {
  const { webSalesId } = await props.params
  let storefront: Storefront | null
  try {
    storefront = await resolveStorefront(webSalesId)
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
  return {
    title: `Buy WAEC checkers from ${name}`,
    description: `Buy WAEC and BECE result checkers securely from ${name} on Doraf. Pay with Mobile Money and receive your serial and PIN by SMS.`,
    openGraph: {
      title: `Buy WAEC checkers from ${name}`,
      description: `Buy WAEC and BECE result checkers securely from ${name} on Doraf. Pay with Mobile Money and receive your serial and PIN by SMS.`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Buy WAEC checkers from ${name}`,
      description: `Buy WAEC and BECE result checkers securely from ${name} on Doraf. Pay with Mobile Money and receive your serial and PIN by SMS.`,
    },
    alternates: {
      canonical: `/buy/${webSalesId}`,
    },
    robots: { index: false, follow: true },
  }
}

export default async function StorefrontPage(
  props: PageProps<"/buy/[webSalesId]">
) {
  const { webSalesId } = await props.params
  let storefront: Storefront
  try {
    storefront = await resolveStorefront(webSalesId)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  const agentWithDefaults = {
    ...storefront.agent,
    storeName: storefront.agent.storeName || storefront.agent.displayName,
  }

  return (
    <>
      <Script
        src="https://js.paystack.co/v2/inline.js"
        strategy="afterInteractive"
      />
      <StorefrontLandingView
        agent={agentWithDefaults}
        webSalesId={storefront.channel?.publicId || webSalesId}
        products={storefront.products}
      />
    </>
  )
}
