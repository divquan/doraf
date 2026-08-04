import { Spinner } from "@workspace/ui/components/spinner"

// Lightweight skeleton shown while the store resolves. Uses a plain spinner to
// avoid implying any seller identity (which is not known until resolution
// completes) and to keep the bundle small.
export default function Loading() {
  return (
    <main className="min-h-svh bg-muted/35">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-5 py-24 sm:px-8">
        <Spinner className="size-8" />
        <p className="text-sm text-muted-foreground">Loading store…</p>
      </div>
    </main>
  )
}
