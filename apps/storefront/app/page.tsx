import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  CreditCardIcon,
  Link02Icon,
  MoneyReceiveCircleIcon,
  Share08Icon,
  SmartPhone01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { MarketingFooter } from "@/components/marketing-footer"
import { MarketingHeader } from "@/components/marketing-header"
import { getAgentPortalUrl } from "@/components/marketing-links"

export const metadata: Metadata = {
  title: "Dashchecker — Sell WAEC Checkers Online",
  description:
    "Create a personal link, sell genuine WAEC result checkers, and earn from every sale.",
}

export default function Page() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <MarketingHeader />

      <main>
        <section className="mx-auto max-w-4xl px-5 py-14 text-center sm:px-8 sm:py-20 lg:py-24">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Sell online with Dashchecker
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl font-heading text-4xl leading-[1] font-semibold tracking-[-0.05em] text-balance sm:text-6xl lg:text-[5rem]">
            Sell WAEC checkers. Keep the profit.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-pretty text-muted-foreground sm:text-xl">
            Get your own store link, share it with people you know, and earn on
            every sale. Dashchecker handles the inventory, payment, and SMS
            delivery.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              render={
                <a
                  href={getAgentPortalUrl()}
                  target="_blank"
                  rel="noreferrer"
                />
              }
              size="lg"
            >
              Start selling
              <HugeiconsIcon data-icon="inline-end" icon={ArrowUpRight01Icon} />
            </Button>
            <Link
              className="inline-flex min-h-10 items-center gap-2 px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              href="#how-it-works"
            >
              See how it works
              <HugeiconsIcon className="size-4" icon={ArrowRight01Icon} />
            </Link>
          </div>

          <div className="mx-auto mt-12 flex max-w-2xl flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <HeroPoint text="No capital needed" />
            <HeroPoint text="Automatic delivery" />
            <HeroPoint text="Mobile Money payouts" />
          </div>

          <figure className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-[2rem] bg-muted shadow-[0_24px_70px_-28px_rgba(77,49,23,0.45)] outline outline-1 outline-black/10">
            <Image
              alt="A Ghanaian shop owner using Dashchecker at a storefront counter"
              className="h-auto w-full object-cover"
              height={848}
              priority
              src="/ghanaian-storefront-product-shot.jpg"
              width={1264}
            />
          </figure>
        </section>

        <section className="border-y border-border/70 bg-muted/25">
          <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-20">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                How it works
              </p>
              <h2 className="mt-4 max-w-md font-heading text-4xl leading-[1.04] font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
                Turn your conversations into sales.
              </h2>
              <p className="mt-5 max-w-md text-base leading-7 text-pretty text-muted-foreground">
                You already know people who need results checkers. Give them a
                simple way to buy from you.
              </p>
            </div>

            <ol className="border-t border-border/80">
              <Step
                icon={Link02Icon}
                number="01"
                title="Create your store"
                text="Sign up and get one personal link for your checker business."
              />
              <Step
                icon={Share08Icon}
                number="02"
                title="Share it everywhere"
                text="Post it on WhatsApp, Facebook, Instagram, or send it directly."
              />
              <Step
                icon={CreditCardIcon}
                number="03"
                title="Your customer pays"
                text="They choose a checker and pay securely with Mobile Money."
              />
              <Step
                icon={MoneyReceiveCircleIcon}
                number="04"
                title="You earn"
                text="Dashchecker sends the checker by SMS and credits your profit to your wallet."
              />
            </ol>
          </div>
        </section>

        <section
          className="mx-auto max-w-5xl px-5 py-20 sm:px-8 sm:py-28"
          id="for-agents"
        >
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Why agents choose Dashchecker
            </p>
            <h2 className="mt-4 font-heading text-4xl leading-[1.04] font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
              Everything you need to sell, without the parts that slow you down.
            </h2>
          </div>

          <div className="mt-12 grid gap-x-10 gap-y-8 border-t border-border/80 pt-8 sm:grid-cols-2 lg:grid-cols-3">
            <Benefit
              icon={SmartPhone01Icon}
              title="Works from your phone"
              text="Share your link wherever your customers already spend time."
            />
            <Benefit
              icon={CreditCardIcon}
              title="No payment chasing"
              text="Customers pay through a secure hosted checkout."
            />
            <Benefit
              icon={MoneyReceiveCircleIcon}
              title="Profit you can follow"
              text="Every sale is tracked in your wallet for easy withdrawal."
            />
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 pb-20 sm:px-8 sm:pb-28">
          <div className="rounded-3xl bg-foreground px-6 py-12 text-background sm:px-12 sm:py-16">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Ready when you are
            </p>
            <div className="mt-5 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <h2 className="max-w-2xl font-heading text-4xl leading-[1.04] font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
                Start with the people who already ask you for checkers.
              </h2>
              <div className="shrink-0">
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/85"
                  render={
                    <a
                      href={getAgentPortalUrl()}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                  size="lg"
                >
                  Create your store
                  <HugeiconsIcon
                    data-icon="inline-end"
                    icon={ArrowUpRight01Icon}
                  />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}

function HeroPoint({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <HugeiconsIcon className="size-4 text-primary" icon={Tick02Icon} />
      {text}
    </span>
  )
}

function Step({
  icon,
  number,
  text,
  title,
}: {
  icon: typeof Link02Icon
  number: string
  text: string
  title: string
}) {
  return (
    <li className="grid gap-4 border-b border-border/80 py-5 sm:grid-cols-[44px_1fr] sm:gap-5">
      <div className="flex items-center gap-3 sm:block">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HugeiconsIcon className="size-4" icon={icon} />
        </span>
        <span className="font-mono text-xs text-muted-foreground sm:mt-2 sm:block">
          {number}
        </span>
      </div>
      <div>
        <h3 className="font-heading text-xl font-semibold tracking-tight">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
      </div>
    </li>
  )
}

function Benefit({
  icon,
  text,
  title,
}: {
  icon: typeof Link02Icon
  text: string
  title: string
}) {
  return (
    <div>
      <HugeiconsIcon className="size-5 text-primary" icon={icon} />
      <h3 className="mt-4 font-heading text-xl font-semibold tracking-tight">
        {title}
      </h3>
      <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
        {text}
      </p>
    </div>
  )
}
