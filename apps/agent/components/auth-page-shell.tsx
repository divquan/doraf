import { DorafMark } from "@/components/doraf-mark"

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh bg-muted/40">
      <div className="grid min-h-svh lg:grid-cols-[1.05fr_0.95fr]">
        <section
          className="relative hidden overflow-hidden bg-[#23232d] lg:block"
          style={{
            backgroundImage: "url('/striped-gradients.svg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <p className="absolute bottom-6 left-6 text-sm font-medium text-white/70 xl:bottom-8 xl:left-8">
            Secure, passwordless checkout. Same-day earnings.
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
