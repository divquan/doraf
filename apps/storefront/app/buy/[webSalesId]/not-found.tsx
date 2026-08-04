import type { Metadata } from "next"
import Link from "next/link"
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
import { DorafMark } from "@/components/doraf-mark"

export const metadata: Metadata = {
  title: "Store not found",
  description: "This Doraf store link is not valid.",
  robots: { index: false, follow: false },
}

// A tailored not-found page so a mistyped, retired, or suspended-agent link is
// clearly explained to the buyer. The same response is returned for unknown and
// suspended-agent identifiers (see agents-and-sales-channels.md), so this page
// intentionally reveals nothing about why the link failed.
export default function NotFound() {
  return (
    <main className="min-h-svh bg-muted/35">
      <header className="border-b bg-background/90">
        <div className="mx-auto flex max-w-5xl items-center px-5 py-4 sm:px-8">
          <DorafMark variant="buyer" />
        </div>
      </header>
      <div className="mx-auto flex max-w-5xl items-center px-5 py-16 sm:px-8">
        <Empty className="w-full border bg-background/60">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={1.7} />
            </EmptyMedia>
            <EmptyTitle>This store link isn&apos;t valid</EmptyTitle>
            <EmptyDescription>
              The link may be mistyped, no longer active, or the store may be
              temporarily unavailable. Check the link you received and try
              again. If you already paid, you can recover your purchase.
            </EmptyDescription>
          </EmptyHeader>
          <div className="flex flex-wrap gap-3">
            <Button render={<Link href="/recover" />}>
              Recover a purchase
            </Button>
          </div>
        </Empty>
      </div>
    </main>
  )
}
