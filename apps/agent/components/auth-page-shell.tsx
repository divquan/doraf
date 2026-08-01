import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  SecurityCheckIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import { DorafMark } from "@/components/doraf-mark"

const promises = [
  { icon: SecurityCheckIcon, text: "Passwordless phone verification" },
  { icon: Store01Icon, text: "Your own private sales workspace" },
  { icon: CheckmarkCircle02Icon, text: "Clear earnings and activity records" },
]

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh bg-muted/40">
      <div className="mx-auto grid min-h-svh max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="absolute -top-28 -left-24 size-80 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative">
            <DorafMark />
          </div>
          <div className="relative flex max-w-xl flex-col gap-8">
            <div className="flex flex-col gap-4">
              <p className="text-sm font-semibold tracking-[0.18em] text-background/60 uppercase">
                Built for independent sellers
              </p>
              <h1 className="font-heading text-5xl leading-[1.05] font-semibold tracking-tight text-balance xl:text-6xl">
                Your checker business, clearly managed.
              </h1>
              <p className="max-w-lg text-lg leading-8 text-pretty text-background/65">
                Set your prices, share your permanent sales channels, and follow
                every sale from one focused workspace.
              </p>
            </div>
            <ul className="flex flex-col gap-4">
              {promises.map(({ icon, text }) => (
                <li
                  className="flex items-center gap-3 text-sm text-background/80"
                  key={text}
                >
                  <span className="flex size-8 items-center justify-center rounded-xl bg-background/10">
                    <HugeiconsIcon icon={icon} strokeWidth={1.8} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-xs text-background/45">
            Secure access · Ghana phone numbers · No reusable passwords
          </p>
        </section>
        <section className="flex min-w-0 flex-col p-5 sm:p-8 lg:p-12">
          <div className="mb-10 lg:hidden">
            <DorafMark />
          </div>
          <div className="flex flex-1 items-center justify-center pb-12">
            {children}
          </div>
          <p className="text-center text-xs leading-5 text-pretty text-muted-foreground">
            By continuing, you agree to Doraf&apos;s platform terms and
            acknowledge its privacy notice.
          </p>
        </section>
      </div>
    </main>
  )
}
