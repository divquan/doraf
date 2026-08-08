"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Copy01Icon,
  CheckmarkCircle02Icon,
  QrCodeIcon,
  Link02Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

export function StoreShareBanner({
  subdomainUrl,
  qrDataUrl,
}: {
  subdomainUrl: string
  qrDataUrl?: string | null
}) {
  const [copied, setCopied] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(subdomainUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <HugeiconsIcon icon={Store01Icon} className="size-3.5" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-muted-foreground shrink-0">
              Store Link:
            </span>
            <span className="truncate font-mono text-xs font-semibold text-foreground">
              {subdomainUrl}
            </span>
            <span className="flex size-2 shrink-0 rounded-full bg-emerald-500" title="Active" />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            onClick={handleCopy}
            variant={copied ? "default" : "outline"}
            size="sm"
            className="gap-1 text-xs h-8 px-2.5"
          >
            <HugeiconsIcon
              icon={copied ? CheckmarkCircle02Icon : Copy01Icon}
              className="size-3"
            />
            {copied ? "Copied!" : "Copy"}
          </Button>

          {qrDataUrl ? (
            <Button
              onClick={() => setQrOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1 text-xs h-8 px-2.5"
            >
              <HugeiconsIcon icon={QrCodeIcon} className="size-3" />
              QR
            </Button>
          ) : null}

          <Button
            render={
              <a href={subdomainUrl} target="_blank" rel="noopener noreferrer" />
            }
            variant="ghost"
            size="sm"
            className="gap-1 text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={Link02Icon} className="size-3" />
            Open
          </Button>
        </div>
      </div>

      {/* QR Code Dialog */}
      {qrDataUrl ? (
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogPopup className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center text-lg font-semibold">
                Storefront QR Code
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center p-4 gap-4">
              <div className="rounded-lg border bg-white p-4">
                <img
                  src={qrDataUrl}
                  alt="Storefront QR Code"
                  className="size-48 object-contain"
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Customers can scan this code to access your storefront.
              </p>
            </div>
          </DialogPopup>
        </Dialog>
      ) : null}
    </>
  )
}
