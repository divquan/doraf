import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import Script from "next/script"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Comment01Icon,
  Megaphone01Icon,
  SecurityCheckIcon,
  ShoppingBag01Icon,
  StoreVerifiedIcon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { money } from "@workspace/ui/lib/format"
import { DorafMark } from "@/components/doraf-mark"
import {
  StorefrontCheckout,
  type StorefrontProduct,
} from "@/components/storefront-checkout"
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
      canonical: `https://${slug}.doraf.app`,
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

  const agent = storefront.agent
  const storeDisplayName = agent.storeName || agent.displayName
  const whatsappClean = agent.whatsappNumber
    ? agent.whatsappNumber.replace(/[^0-9]/g, "")
    : null

  return (
    <main className="min-h-svh bg-muted/35">
      <Script
        src="https://js.paystack.co/v2/inline.js"
        strategy="afterInteractive"
      />
      {agent.announcement ? (
        <div className="bg-primary px-4 py-2 text-center text-xs font-medium text-primary-foreground sm:text-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-center gap-2">
            <HugeiconsIcon icon={Megaphone01Icon} className="size-4 shrink-0" />
            <span className="truncate">{agent.announcement}</span>
          </div>
        </div>
      ) : null}

      <header className="border-b bg-background/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <DorafMark variant="buyer" />
          <div className="flex items-center gap-2">
            <Button render={<Link href="/recover" />} size="sm" variant="ghost">
              Recover purchase
            </Button>
            <Badge className="hidden sm:flex" variant="secondary">
              <HugeiconsIcon icon={SecurityCheckIcon} />
              Secure checkout
            </Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
        {agent.bannerUrl ? (
          <div className="overflow-hidden rounded-2xl border shadow-sm">
            <img
              src={agent.bannerUrl}
              alt={`${storeDisplayName} banner`}
              className="h-44 w-full object-cover sm:h-56"
            />
          </div>
        ) : null}

        <section className="flex flex-col gap-4 text-center sm:items-center">
          <Card className="w-full max-w-md border-border/75 bg-background/70 shadow-sm">
            <CardContent className="flex items-center gap-3 px-4 py-3">
              {agent.logoUrl ? (
                <img
                  src={agent.logoUrl}
                  alt={storeDisplayName}
                  className="size-11 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <HugeiconsIcon icon={StoreVerifiedIcon} strokeWidth={1.8} />
                </span>
              )}
              <div className="min-w-0 text-left">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Buying from
                </p>
                <p className="truncate font-heading text-lg font-semibold text-foreground">
                  {storeDisplayName}
                </p>
                {agent.tagline ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {agent.tagline}
                  </p>
                ) : null}
              </div>
              <Badge
                className="ml-auto hidden shrink-0 sm:flex"
                variant="outline"
              >
                Verified by Doraf
              </Badge>
            </CardContent>
          </Card>

          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            WAEC result checkers, delivered securely.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-pretty text-muted-foreground">
            Choose the checker that matches your examination, pay with Mobile
            Money, and receive your serial number and PIN by SMS.
          </p>
        </section>

        {storefront.products.length === 0 ? (
          <Empty className="min-h-56 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={ShoppingBag01Icon} strokeWidth={1.7} />
              </EmptyMedia>
              <EmptyTitle>No checkers available right now</EmptyTitle>
              <EmptyDescription>
                This store is active, but its checker products are currently
                unavailable. Please check again later.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <section className="grid gap-5 md:grid-cols-3">
              {storefront.products.map((product) => (
                <Card key={product.id}>
                  <CardHeader>
                    <CardTitle>{product.name}</CardTitle>
                    <CardDescription className="leading-6">
                      {product.scopeDisclosure}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="font-heading text-2xl font-semibold">
                      {money(product.retailPriceMinor, product.currency)}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" render={<a href="#checkout" />}>
                      Begin checkout
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </section>
            <StorefrontCheckout
              products={storefront.products}
              webSalesId={storefront.channel.publicId}
            />
          </>
        )}
      </div>

      {whatsappClean ? (
        <a
          href={`https://wa.me/${whatsappClean}?text=${encodeURIComponent(`Hi ${storeDisplayName}, I need help with my WAEC checker purchase.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 font-medium text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Chat on WhatsApp"
        >
          <HugeiconsIcon icon={Comment01Icon} className="size-5" />
          <span className="hidden text-sm font-semibold sm:inline">
            Help on WhatsApp
          </span>
        </a>
      ) : null}
    </main>
  )
}
