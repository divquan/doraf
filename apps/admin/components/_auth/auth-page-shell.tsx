import Image from "next/image"

export function AuthPageShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative min-h-svh">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-5 right-5 z-10 sm:top-8 sm:right-8"
      >
        <Image
          alt=""
          className="block h-8 w-auto object-contain drop-shadow-sm dark:hidden"
          height={347}
          src="/logo.svg"
          width={1127}
        />
        <Image
          alt=""
          className="hidden h-8 w-auto object-contain drop-shadow-sm dark:block"
          height={347}
          src="/logo-dark.svg"
          width={1127}
        />
      </div>
      <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-8 p-6">
        {children}
      </main>
    </div>
  )
}
