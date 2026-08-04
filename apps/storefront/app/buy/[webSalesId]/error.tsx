"use client"

import { useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"

// Error boundary for the store segment. The store page calls a server-side API
// to resolve the channel; a transient failure (API unavailable, network error)
// should let the buyer retry rather than showing a hard error. The 404 path is
// handled separately by not-found.tsx, so this boundary covers everything else.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    // Surface transient resolution failures for observability. Do not include
    // the web sales identifier, which is personal-data-adjacent.
    console.error("Storefront resolution failed", {
      digest: error.digest,
      message: error.message,
    })
  }, [error])

  return (
    <main className="min-h-svh bg-muted/35">
      <div className="mx-auto flex max-w-5xl items-center px-5 py-16 sm:px-8">
        <Empty className="w-full border bg-background/60">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={1.7} />
            </EmptyMedia>
            <EmptyTitle>We couldn&apos;t load this store</EmptyTitle>
            <EmptyDescription>
              Something went wrong while opening the store. Please try again. If
              the problem continues, ask the seller for a fresh link.
            </EmptyDescription>
          </EmptyHeader>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => unstable_retry()} type="button">
              Try again
            </Button>
          </div>
        </Empty>
      </div>
    </main>
  )
}
