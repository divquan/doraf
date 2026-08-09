import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Link02Icon,
  MoneyReceiveCircleIcon,
  PencilEdit02Icon,
  SecurityCheckIcon,
  Share08Icon,
  SmartPhone01Icon,
  Store01Icon,
  Wallet02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { MarketingFooter } from "@/components/marketing-footer"
import { MarketingHeader } from "@/components/marketing-header"
import { getAgentPortalUrl } from "@/components/marketing-links"

export const metadata: Metadata = {
  title: "Become a Dashchecker Agent",
  description:
    "Create a personalized WAEC checker storefront, share it with your community, and earn on every attributed sale.",
}

export default function BecomeAnAgentPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <MarketingHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border/70 bg-muted/35">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_35%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-28">
            <div className="max-w-2xl">
              <Badge variant="outline">Become a Dashchecker agent</Badge>
              <h1 className="mt-5 font-heading text-5xl leading-[1] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
                Your next side business can start with one link.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-pretty text-muted-foreground sm:text-xl">
                Sell genuine WAEC checkers to people you already know. Dashchecker
                gives you the storefront, the inventory, and the workflow to
                turn interest into attributed sales.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
                  Create your agent account
                  <HugeiconsIcon
                    data-icon="inline-end"
                    icon={ArrowUpRight01Icon}
                  />
                </Button>
                <Button
                  render={<Link href="#steps" />}
                  size="lg"
                  variant="outline"
                >
                  See the steps
                  <HugeiconsIcon
                    data-icon="inline-end"
                    icon={ArrowRight01Icon}
                  />
                </Button>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Registration uses your phone number and SMS one-time passwords.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
              <div className="absolute -inset-4 rounded-[2rem] bg-primary/15 blur-3xl" />
              <div className="relative rounded-[2rem] border border-border/70 bg-card p-5 shadow-2xl shadow-primary/10 sm:p-6">
                <div className="flex items-center justify-between border-b border-border/70 pb-5">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Agent snapshot
                    </p>
                    <p className="mt-1 font-heading text-2xl font-semibold">
                      Your work, your reach
                    </p>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <HugeiconsIcon className="size-5" icon={Store01Icon} />
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-5">
                  <Metric label="Storefront" value="Active" icon={Link02Icon} />
                  <Metric
                    label="Customers"
                    value="Growing"
                    icon={Share08Icon}
                  />
                  <Metric
                    label="Inventory"
                    value="Ready"
                    icon={SecurityCheckIcon}
                  />
                  <Metric
                    label="Earnings"
                    value="Trackable"
                    icon={Wallet02Icon}
                  />
                </div>
                <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-white/15">
                      <HugeiconsIcon
                        className="size-4"
                        icon={MoneyReceiveCircleIcon}
                      />
                    </span>
                    <div>
                      <p className="text-xs text-primary-foreground/70">
                        Every sale is attributed
                      </p>
                      <p className="mt-0.5 text-sm font-semibold">
                        Your margin stays visible
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="max-w-2xl">
            <Badge variant="outline">What you get</Badge>
            <h2 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Everything you need to start selling digitally.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Benefit
              icon={Store01Icon}
              title="Your own storefront"
              text="A personalized link customers can open from any phone."
            />
            <Benefit
              icon={PencilEdit02Icon}
              title="Flexible pricing"
              text="Set retail prices within Dashchecker's allowed pricing range."
            />
            <Benefit
              icon={SmartPhone01Icon}
              title="Digital delivery"
              text="Dashchecker handles checker inventory and SMS fulfillment."
            />
            <Benefit
              icon={Wallet02Icon}
              title="Trackable earnings"
              text="See attributed sales and request wallet withdrawals."
            />
          </div>
        </section>

        <section className="border-y border-border/70 bg-card/35" id="steps">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
              <div>
                <Badge variant="outline">Three simple steps</Badge>
                <h2 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                  Start small. Keep building.
                </h2>
                <p className="mt-4 text-lg leading-8 text-pretty text-muted-foreground">
                  You bring the relationships. Dashchecker provides the rails that
                  make selling checkers straightforward.
                </p>
              </div>
              <div className="space-y-4">
                <AgentStep
                  number="01"
                  icon={SmartPhone01Icon}
                  title="Register with your phone"
                  text="Create your account with your name and phone number, then verify with SMS."
                />
                <AgentStep
                  number="02"
                  icon={PencilEdit02Icon}
                  title="Set up your storefront"
                  text="Choose your retail prices and make your store feel like yours."
                />
                <AgentStep
                  number="03"
                  icon={Share08Icon}
                  title="Share and earn"
                  text="Send your link to customers, track sales, and withdraw available earnings."
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="rounded-[2rem] border border-border/70 bg-muted/35 px-6 py-12 sm:px-12 sm:py-16">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
                Start selling with Dashchecker
              </p>
              <h2 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Make your first share count.
              </h2>
              <p className="mt-4 text-lg leading-8 text-pretty text-muted-foreground">
                Your customers already have questions about results. Give them a
                simple place to get the right checker.
              </p>
              <Button
                className="mt-8"
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

function Metric({
  icon,
  label,
  value,
}: {
  icon: typeof Link02Icon
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background p-3">
      <HugeiconsIcon className="size-4 text-primary" icon={icon} />
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  )
}

function Benefit({
  icon,
  title,
  text,
}: {
  icon: typeof Store01Icon
  title: string
  text: string
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <HugeiconsIcon className="size-5" icon={icon} />
      </span>
      <h3 className="mt-7 font-heading text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  )
}

function AgentStep({
  icon,
  number,
  title,
  text,
}: {
  icon: typeof SmartPhone01Icon
  number: string
  title: string
  text: string
}) {
  return (
    <div className="flex gap-4 rounded-3xl border border-border/70 bg-card p-5 sm:gap-5 sm:p-6">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
        <HugeiconsIcon className="size-5" icon={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
          {number}
        </p>
        <h3 className="mt-1 font-heading text-xl font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}
