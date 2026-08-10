import Link from "next/link"
import { MarketingBrand } from "@/components/marketing-brand"
import { getAgentPortalUrl } from "./marketing-links"

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/70 bg-card/35">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-4">
          <Link
            aria-label="Dashchecker home"
            className="inline-flex rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:outline-none"
            href="/"
          >
            <MarketingBrand />
          </Link>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            A simpler way to sell and buy WAEC result checkers in Ghana.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
          <Link
            className="transition-colors hover:text-foreground"
            href="/become-an-agent"
          >
            Become an agent
          </Link>
          <Link
            className="transition-colors hover:text-foreground"
            href="/checkers"
          >
            Checkers
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/faq">
            FAQ
          </Link>
          <Link
            className="transition-colors hover:text-foreground"
            href="/recover"
          >
            Recover a purchase
          </Link>
          <Link
            className="transition-colors hover:text-foreground"
            href="/terms-of-service"
          >
            Terms of Service
          </Link>
          <Link
            className="transition-colors hover:text-foreground"
            href="/privacy-policy"
          >
            Privacy Policy
          </Link>
          <a
            className="transition-colors hover:text-foreground"
            href={getAgentPortalUrl()}
            target="_blank"
            rel="noreferrer"
          >
            Agent sign in
          </a>
        </div>
      </div>
      <div className="border-t border-border/60 px-5 py-4 sm:px-8">
        <p className="mx-auto max-w-6xl text-xs text-muted-foreground">
          © {new Date().getFullYear()} Dashchecker. Built for independent
          sellers.
        </p>
      </div>
    </footer>
  )
}
