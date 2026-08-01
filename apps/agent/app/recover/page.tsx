import type { Metadata } from "next"
import { BuyerRecoveryFlow } from "@/components/buyer-recovery-flow"
import { DorafMark } from "@/components/doraf-mark"

export const metadata: Metadata = {
  title: "Recover a purchase",
  description: "Securely recover checkers from a completed Doraf purchase.",
}

export default function RecoverPage() {
  return (
    <main className="min-h-svh bg-muted/35">
      <header className="border-b bg-background/90">
        <div className="mx-auto flex max-w-5xl items-center px-5 py-4 sm:px-8">
          <DorafMark />
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <section className="flex flex-col gap-4 lg:sticky lg:top-10">
          <p className="text-sm font-semibold tracking-[0.16em] text-primary uppercase">
            Purchase recovery
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Get your checker details back securely.
          </h1>
          <p className="max-w-xl text-base leading-7 text-pretty text-muted-foreground">
            Enter the reference from a paid order. We&apos;ll verify access
            using the phone number chosen when the order was placed.
          </p>
          <div className="rounded-xl border bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
            Doraf will never ask you to change the delivery number or disclose a
            payment account during recovery.
          </div>
        </section>
        <BuyerRecoveryFlow />
      </div>
    </main>
  )
}
