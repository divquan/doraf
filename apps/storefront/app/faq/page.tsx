import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight01Icon, HelpCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { faqItems } from "@/components/marketing-content"
import { MarketingFooter } from "@/components/marketing-footer"
import { MarketingHeader } from "@/components/marketing-header"
import { getAgentPortalUrl } from "@/components/marketing-links"

export const metadata: Metadata = {
  title: "Dashchecker FAQ",
  description:
    "Answers for buying WAEC checkers, becoming a Dashchecker agent, delivery, earnings, and withdrawals.",
}

export default function FaqPage() {
  const buyingFaqs = faqItems.filter((item) => item.category === "Buying")
  const sellingFaqs = faqItems.filter((item) => item.category === "Selling")

  return (
    <div className="min-h-svh bg-background text-foreground">
      <MarketingHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border/70 bg-muted/35">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,color-mix(in_oklch,var(--primary)_15%,transparent),transparent_36%)]" />
          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
            <Badge variant="outline">Frequently asked questions</Badge>
            <h1 className="mt-5 max-w-3xl font-heading text-5xl leading-[1] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
              Clear answers before your next click.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-pretty text-muted-foreground sm:text-xl">
              Whether you are buying a checker or starting as an agent, here are
              the basics you need to move with confidence.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <FaqGroup title="For buyers" items={buyingFaqs} />
            <FaqGroup title="For agents" items={sellingFaqs} />
          </div>
        </section>

        <section className="border-y border-border/70 bg-card/35">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-14 sm:px-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <HugeiconsIcon className="size-5" icon={HelpCircleIcon} />
              </span>
              <div>
                <h2 className="font-heading text-xl font-semibold">
                  Still need a hand?
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  If you have a purchase, keep your order reference and delivery
                  number nearby when asking for help.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button render={<Link href="/recover" />} variant="outline">
                Recover a purchase
              </Button>
              <Button
                render={
                  <a
                    href={getAgentPortalUrl()}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                Agent sign in
                <HugeiconsIcon
                  data-icon="inline-end"
                  icon={ArrowUpRight01Icon}
                />
              </Button>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}

function FaqGroup({
  items,
  title,
}: {
  items: readonly (typeof faqItems)[number][]
  title: string
}) {
  return (
    <div>
      <h2 className="font-heading text-3xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-6 divide-y divide-border/70 rounded-3xl border border-border/70 bg-card px-5 sm:px-6">
        {items.map((item) => (
          <details
            className="group py-5 first:pt-2 last:pb-2"
            key={item.question}
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-5 py-3 font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="text-base leading-6 text-balance">
                {item.question}
              </span>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-normal text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="max-w-xl pb-3 text-sm leading-7 text-pretty text-muted-foreground">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </div>
  )
}
