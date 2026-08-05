"use client"

import { useState } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Comment01Icon,
  CreditCardIcon,
  Download04Icon,
  FlashIcon,
  Megaphone01Icon,
  SecurityCheckIcon,
  ShoppingBag01Icon,
  StoreVerifiedIcon,
  Tag01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { money } from "@workspace/ui/lib/format"
import { DorafMark } from "@/components/doraf-mark"
import { CheckoutModal } from "./checkout-modal"
import { type StorefrontProduct } from "./storefront-checkout"

export interface StorefrontAgent {
  displayName: string
  storeName: string
  tagline?: string | null
  logoUrl?: string | null
  bannerUrl?: string | null
  whatsappNumber?: string | null
  themePreset?: string | null
  announcement?: string | null
}

export function StorefrontLandingView({
  agent,
  webSalesId,
  products,
}: {
  agent: StorefrontAgent
  webSalesId: string
  products: StorefrontProduct[]
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>()

  const storeDisplayName = agent.storeName || agent.displayName
  const whatsappClean = agent.whatsappNumber ? agent.whatsappNumber.replace(/[^0-9]/g, "") : null

  function handleOpenCheckout(productId?: string) {
    setSelectedProductId(productId)
    setModalOpen(true)
  }

  return (
    <div className="min-h-svh bg-muted/30 text-foreground selection:bg-primary/20 selection:text-primary pb-24">
      {/* 1. ANNOUNCEMENT TICKER */}
      {agent.announcement && (
        <div className="bg-muted/80 border-b px-4 py-2 text-center text-xs font-semibold text-muted-foreground sm:text-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-center gap-2">
            <HugeiconsIcon icon={Megaphone01Icon} className="size-4 shrink-0 text-primary" />
            <span className="truncate">{agent.announcement}</span>
          </div>
        </div>
      )}

      {/* 2. CLEAN NAVBAR HEADER */}
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5 sm:px-8">
          <DorafMark variant="buyer" />
          <div className="flex items-center gap-3">
            <Button
              render={<Link href="/recover" />}
              size="sm"
              variant="secondary"
              className="text-xs font-bold gap-1.5"
            >
              <HugeiconsIcon icon={Download04Icon} className="size-3.5" />
              Recover Purchase
            </Button>
          </div>
        </div>
      </header>

      {/* 3. OPEN STORE CANVAS (NO SINGLE ENCLOSING CARD ENCLOSURE) */}
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 space-y-8">
        {/* Cover Banner Area */}
        <div className="relative overflow-hidden rounded-3xl border border-border/70 shadow-sm h-48 w-full bg-gradient-to-r from-primary/10 via-primary/5 to-muted sm:h-64">
          {agent.bannerUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={agent.bannerUrl}
              alt={`${storeDisplayName} cover`}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        {/* Store Profile Identity Section */}
        <div className="px-2 sm:px-4">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
              {/* Overlapping Logo Avatar */}
              <div className="relative -mt-16 size-28 shrink-0 rounded-3xl border-4 border-background bg-card shadow-2xl overflow-hidden sm:-mt-24 sm:size-32">
                {agent.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={agent.logoUrl}
                    alt={storeDisplayName}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center rounded-2xl bg-primary/10 font-heading text-4xl font-extrabold text-primary">
                    {storeDisplayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Store Name & Tagline */}
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2">
                  <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                    {storeDisplayName}
                  </h1>
                  <HugeiconsIcon icon={StoreVerifiedIcon} className="size-6 text-primary shrink-0" />
                </div>
                {agent.tagline && (
                  <p className="text-base text-muted-foreground font-medium">
                    {agent.tagline}
                  </p>
                )}
              </div>
            </div>

            {/* WhatsApp Contact Support */}
            {whatsappClean && (
              <div className="pt-2 sm:pt-0">
                <a
                  href={`https://wa.me/${whatsappClean}?text=${encodeURIComponent(`Hi ${storeDisplayName}, I need help with my WAEC checker purchase.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-transform hover:scale-105 hover:bg-emerald-700"
                >
                  <HugeiconsIcon icon={Comment01Icon} className="size-4" />
                  <span>WhatsApp Support</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* TRUST VALUE CARDS ROW */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3.5 rounded-2xl border bg-card/70 p-4 shadow-xs backdrop-blur-xs">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <HugeiconsIcon icon={FlashIcon} className="size-5" />
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">Instant Delivery</p>
              <p className="text-[11px] text-muted-foreground">Serial & PIN sent via SMS in seconds</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl border bg-card/70 p-4 shadow-xs backdrop-blur-xs">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <HugeiconsIcon icon={CreditCardIcon} className="size-5" />
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">Mobile Money</p>
              <p className="text-[11px] text-muted-foreground">Pay with MTN MoMo, Telecel, AirtelTigo</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl border bg-card/70 p-4 shadow-xs backdrop-blur-xs">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <HugeiconsIcon icon={SecurityCheckIcon} className="size-5" />
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">100% Genuine Cards</p>
              <p className="text-[11px] text-muted-foreground">Valid for any examination year</p>
            </div>
          </div>
        </div>

        {/* PRODUCTS SECTION */}
        <section className="space-y-6 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Available Checkers ({products.length})
            </h2>
            <Badge variant="outline" className="text-xs font-mono">
              Instant SMS Delivery
            </Badge>
          </div>

          {products.length === 0 ? (
            <Empty className="min-h-56 border rounded-3xl bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={ShoppingBag01Icon} strokeWidth={1.7} />
                </EmptyMedia>
                <EmptyTitle>No Checkers Available Right Now</EmptyTitle>
                <EmptyDescription>
                  This store is active, but its checker products are currently being prepared. Please check back shortly.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {products.map((product) => (
                <Card
                  key={product.id}
                  className="flex flex-col justify-between overflow-hidden rounded-3xl border-border/80 bg-card shadow-sm transition-all hover:shadow-xl hover:-translate-y-1"
                >
                  <CardHeader className="gap-3 border-b bg-muted/20 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <HugeiconsIcon icon={Tag01Icon} strokeWidth={1.7} className="size-5" />
                      </div>
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">
                        In Stock
                      </Badge>
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold">{product.name}</CardTitle>
                      <CardDescription className="mt-1 text-xs leading-relaxed">
                        {product.scopeDisclosure || "Valid for checking results for any examination year."}
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-5 space-y-3">
                    <div>
                      <span className="text-xs text-muted-foreground font-medium">Retail Price</span>
                      <p className="font-heading text-3xl font-extrabold text-foreground mt-0.5">
                        {money(product.retailPriceMinor, product.currency)}
                      </p>
                    </div>
                  </CardContent>

                  <CardFooter className="border-t bg-muted/15 pt-4">
                    <Button
                      onClick={() => handleOpenCheckout(product.id)}
                      className="w-full gap-2 font-bold py-6 text-base bg-primary hover:bg-primary/90 text-primary-foreground shadow-md rounded-2xl"
                    >
                      <HugeiconsIcon icon={ShoppingBag01Icon} className="size-5" />
                      Buy Now — {money(product.retailPriceMinor, product.currency)}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Floating WhatsApp Support Button */}
      {whatsappClean && (
        <a
          href={`https://wa.me/${whatsappClean}?text=${encodeURIComponent(`Hi ${storeDisplayName}, I need help with my WAEC checker purchase.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-emerald-600 px-5 py-3.5 font-semibold text-white shadow-xl transition-all hover:scale-105 hover:bg-emerald-700 active:scale-95"
          aria-label="Chat on WhatsApp"
        >
          <HugeiconsIcon icon={Comment01Icon} className="size-5" />
          <span className="hidden text-sm font-bold sm:inline">
            Help on WhatsApp
          </span>
        </a>
      )}

      {/* Progressive Disclosure Modal Checkout */}
      <CheckoutModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        products={products}
        webSalesId={webSalesId}
        initialProductId={selectedProductId}
      />
    </div>
  )
}
