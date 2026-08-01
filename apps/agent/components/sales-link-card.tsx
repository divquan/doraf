"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Link01Icon, Share08Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
      setMessage("Sales link copied")
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
        title: "Buy a WAEC result checker",
        text: "Get your WAEC result checker securely through my Doraf store.",
        url: salesUrl,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setMessage("Sharing is unavailable. Copy the link instead.")
    }
  }

  return (
    <Card className="overflow-hidden border-border/75 shadow-sm">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex size-11 items-center justify-center rounded-xl border bg-background text-primary shadow-xs">
          <HugeiconsIcon icon={Link01Icon} strokeWidth={1.7} />
        </div>
        <CardTitle className="mt-3 text-xl">
          Your permanent sales link
        </CardTitle>
        <CardDescription className="max-w-xl leading-6">
          Share this link with buyers. Every completed purchase through it is
          attributed to your Doraf account and uses the prices above.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-5">
        <Input
          aria-label="Permanent sales link"
          className="h-11 font-mono text-xs sm:text-sm"
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
            This link cannot accept new purchases while your account is
            suspended.
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3 border-t bg-muted/15 pt-4">
        <Button onClick={copyLink} type="button" variant="outline">
          <HugeiconsIcon data-icon="inline-start" icon={Copy01Icon} />
          Copy link
        </Button>
        <Button disabled={readOnly} onClick={shareLink} type="button">
          <HugeiconsIcon data-icon="inline-start" icon={Share08Icon} />
          Share
        </Button>
      </CardFooter>
    </Card>
  )
}
