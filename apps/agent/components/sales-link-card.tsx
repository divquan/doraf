"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Share08Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

export function SalesLinkCard({
  salesUrl,
  readOnly,
}: {
  salesUrl: string
  readOnly: boolean
}) {
  const [message, setMessage] = useState<string | null>(null)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(salesUrl)
      setMessage("Store link copied!")
    } catch {
      setMessage("Copy failed. Select the link and copy it manually.")
    }
  }

  async function shareLink() {
    if (!navigator.share) {
      await copyLink()
      return
    }
    try {
      await navigator.share({
        title: "Buy WAEC Checker",
        text: "Buy WAEC and BECE result checkers securely from my online store.",
        url: salesUrl,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setMessage("Sharing is unavailable. Copy the link instead.")
    }
  }

  function shareOnWhatsApp() {
    const text = `Hello! You can buy WAEC and BECE result checkers securely from my shop using Mobile Money. Click here to buy: ${salesUrl}`
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">Store Link</h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Copy and share this link to sell checkers. Customers pay securely via Mobile Money or Card.
        </p>
      </div>

      <div className="space-y-3">
        <Input
          aria-label="Store link"
          className="h-10 font-mono text-xs sm:text-sm bg-muted/10 border-border/60"
          readOnly
          value={salesUrl}
        />

        {message ? (
          <p className="text-sm font-medium text-foreground" role="status">
            {message}
          </p>
        ) : null}
        {readOnly ? (
          <p className="text-sm leading-6 text-muted-foreground">
            This link cannot accept new purchases while your account is suspended.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={copyLink} type="button" variant="outline">
          <HugeiconsIcon data-icon="inline-start" icon={Copy01Icon} />
          Copy Link
        </Button>
        <Button disabled={readOnly} onClick={shareLink} type="button" variant="outline">
          <HugeiconsIcon data-icon="inline-start" icon={Share08Icon} />
          Share
        </Button>
        <Button
          disabled={readOnly}
          onClick={shareOnWhatsApp}
          type="button"
          className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
        >
          <svg className="size-4 shrink-0 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.012 2c-5.506 0-9.988 4.482-9.988 9.988 0 1.76.458 3.478 1.332 5.006L2 22l5.166-1.356c1.47.8 3.116 1.222 4.836 1.222h.004c5.506 0 9.99-4.482 9.99-9.988C22 6.482 17.518 2 12.012 2zm5.728 14.156c-.25.7-1.464 1.34-2.022 1.43-.504.08-1.156.104-1.85-.13-.48-.16-1.082-.4-1.846-.732-3.238-1.41-5.328-4.708-5.49-4.922-.162-.214-1.3-1.728-1.3-3.3 0-1.57.822-2.34 1.116-2.652.25-.264.66-.396 1.056-.396.126 0 .24.006.342.012.3.012.45.03.648.504.246.59.846 2.07.918 2.22.072.15.12.324.02.524-.1.2-.15.324-.3.498-.15.174-.316.388-.45.522-.15.15-.306.314-.132.612.174.298.776 1.282 1.666 2.074.912.812 1.68 1.066 1.98.19.3-.126.66-.372.936-.612.28-.24.372-.324.576-.2.204.126 1.296.612 1.518.726.222.114.372.174.426.27.054.096.054.552-.196 1.254z"/>
          </svg>
          Share on WhatsApp
        </Button>
      </div>
    </div>
  )
}
