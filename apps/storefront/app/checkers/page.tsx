import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  FlashIcon,
  SecurityCheckIcon,
  ShoppingBag01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { checkerProducts } from "@/components/marketing-content"
import { MarketingFooter } from "@/components/marketing-footer"
import { MarketingHeader } from "@/components/marketing-header"
import { getAgentPortalUrl } from "@/components/marketing-links"

export const metadata: Metadata = {
  title: "WAEC Checker Types",
  description:
    "Understand which Dashchecker WAEC checker covers BECE, WASSCE School, WASSCE Private, ABCE, and GBCE results.",
}

export default function CheckersPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <MarketingHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border/70 bg-muted/35">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_34%)]" />
          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
            <div className="max-w-3xl">
              <Badge variant="outline">The Dashchecker catalog</Badge>
              <h1 className="mt-5 font-heading text-5xl leading-[1] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
                Know what each checker covers before you buy.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-pretty text-muted-foreground sm:text-xl">
                Dashchecker keeps the product scope clear so you can choose the right
                checker for the result you need to access.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="grid gap-5 lg:grid-cols-3">
            {checkerProducts.map((product, index) => (
              <article
                className="flex flex-col rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm"
                key={product.name}
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <HugeiconsIcon
                      className="size-6"
                      icon={index === 1 ? FlashIcon : ShoppingBag01Icon}
                    />
                  </span>
                  <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    {product.eyebrow}
                  </span>
                </div>
                <h2 className="mt-8 font-heading text-3xl font-semibold tracking-tight">
                  {product.name}
                </h2>
                <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">
                  {product.description}
                </p>
                <div className="mt-8 space-y-3 border-t border-border/70 pt-6">
                  <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    Covers
                  </p>
                  {product.covers.map((cover) => (
                    <div
                      className="flex items-center gap-2 text-sm"
                      key={cover}
                    >
                      <HugeiconsIcon
                        className="size-4 text-primary"
                        icon={Tick02Icon}
                      />
                      <span>{cover}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-8">
                  <p className="rounded-2xl bg-muted/50 p-4 text-xs leading-5 text-muted-foreground">
                    Check the scope on your agent&apos;s storefront before
                    completing payment.
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-border/70 bg-card/35">
          <div className="mx-auto grid max-w-6xl gap-5 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-3">
            <InfoCard
              icon={SecurityCheckIcon}
              title="Genuine inventory"
              text="Dashchecker centrally sources and manages checker inventory for the platform."
            />
            <InfoCard
              icon={FlashIcon}
              title="No calendar expiry"
              text="Unused vouchers are not made unsellable just because time has passed."
            />
            <InfoCard
              icon={ShoppingBag01Icon}
              title="Digital delivery"
              text="The serial and PIN stay together and are delivered to the number you confirm."
            />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="flex flex-col gap-8 rounded-[2rem] bg-primary px-6 py-12 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:px-12 sm:py-14">
            <div className="max-w-2xl">
              <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Ready to sell checkers to your community?
              </h2>
              <p className="mt-3 text-base leading-7 text-primary-foreground/75">
                Create a storefront, choose your prices within Dashchecker&apos;s
                rules, and start sharing.
              </p>
            </div>
            <Button
              className="shrink-0 bg-background text-foreground hover:bg-background/90"
              render={
                <a
                  href={getAgentPortalUrl()}
                  target="_blank"
                  rel="noreferrer"
                />
              }
              size="lg"
            >
              Become an agent
              <HugeiconsIcon data-icon="inline-end" icon={ArrowUpRight01Icon} />
            </Button>
          </div>
          <Link
            className="mx-auto mt-8 flex w-fit items-center gap-2 text-sm font-semibold text-primary hover:underline"
            href="/faq"
          >
            Have more questions?
            <HugeiconsIcon className="size-4" icon={ArrowRight01Icon} />
          </Link>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: typeof SecurityCheckIcon
  title: string
  text: string
}) {
  return (
    <div className="flex gap-4 rounded-3xl border border-border/70 bg-background p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <HugeiconsIcon className="size-5" icon={icon} />
      </span>
      <div>
        <h3 className="font-heading text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}
