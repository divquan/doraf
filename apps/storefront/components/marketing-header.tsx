import Link from "next/link"
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { MarketingBrand } from "@/components/marketing-brand"
import { getAgentPortalUrl } from "./marketing-links"

export function MarketingHeader() {
  return (
    <header className="relative z-20 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8"
      >
        <Link
          aria-label="Dashchecker home"
          className="shrink-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:outline-none"
          href="/"
        >
          <MarketingBrand />
        </Link>

        <div className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <Link
            className="transition-colors hover:text-foreground"
            href="/become-an-agent"
          >
            For agents
          </Link>
          <Link
            className="transition-colors hover:text-foreground"
            href="/#how-it-works"
          >
            How it works
          </Link>
          <Link
            className="transition-colors hover:text-foreground"
            href="/checkers"
          >
            Checkers
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
            href="/recover"
          >
            Recover purchase
          </Link>
          <Button
            render={
              <a href={getAgentPortalUrl()} target="_blank" rel="noreferrer" />
            }
            size="sm"
          >
            <span className="hidden sm:inline">Start selling</span>
            <span className="sm:hidden">Start</span>
            <HugeiconsIcon data-icon="inline-end" icon={ArrowUpRight01Icon} />
          </Button>
        </div>
      </nav>
    </header>
  )
}
