export function StorefrontFooter({ storeDisplayName }: { storeDisplayName?: string }) {
  const displayTitle = storeDisplayName || "Dashchecker"
  const agentWebUrl = process.env.NEXT_PUBLIC_DORAF_AGENT_WEB_URL || "http://localhost:3002"

  return (
    <footer className="mt-auto border-t bg-card/30 py-6 px-5 sm:px-8 text-xs text-muted-foreground">
      <div className="mx-auto max-w-5xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <p>© {new Date().getFullYear()} {displayTitle}. All rights reserved.</p>
          <span className="hidden sm:inline text-muted-foreground/30">•</span>
          <a
            href={`${agentWebUrl}/register`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors font-medium underline-offset-4 hover:underline"
          >
            Sell checkers? Register as an Agent
          </a>
        </div>
        <p className="flex items-center gap-1">
          Powered by <span className="font-semibold text-foreground/75">Doraf</span>
        </p>
      </div>
    </footer>
  )
}
