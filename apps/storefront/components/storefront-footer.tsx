import Link from "next/link"

export function StorefrontFooter({
  storeDisplayName,
}: {
  storeDisplayName?: string
}) {
  const displayTitle = storeDisplayName || "Dashchecker"
  const agentWebUrl =
    process.env.NEXT_PUBLIC_DASHCHECKER_AGENT_WEB_URL || "http://localhost:3002"

  return (
    <footer className="mt-auto border-t bg-card/30 px-5 py-6 text-xs text-muted-foreground sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <p>
            © {new Date().getFullYear()} {displayTitle}. All rights reserved.
          </p>
          <span className="hidden text-muted-foreground/30 sm:inline">•</span>
          <a
            href={`${agentWebUrl}/register`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            Sell checkers? Register as an Agent
          </a>
          <Link
            className="font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
            href="/terms-of-service"
          >
            Terms of Service
          </Link>
          <Link
            className="font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
            href="/privacy-policy"
          >
            Privacy Policy
          </Link>
        </div>
        <p className="flex items-center gap-1">
          Powered by{" "}
          <span className="font-semibold text-foreground/75">Dashchecker</span>
        </p>
      </div>
    </footer>
  )
}
