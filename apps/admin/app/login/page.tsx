import Link from "next/link"

import { PasskeyLoginForm } from "@/components/passkey-login-form"

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ enrolled?: string }>
}) {
  return <LoginContent searchParams={searchParams} />
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ enrolled?: string }>
}) {
  const { enrolled } = await searchParams
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-8 p-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          Doraf Administration
        </p>
        <h1 className="font-heading text-4xl">Welcome back</h1>
        <p className="text-muted-foreground">
          Sign in to access internal operational tools.
        </p>
      </div>
      {enrolled ? (
        <p className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
          Passkey created. You can sign in now.
        </p>
      ) : null}
      <PasskeyLoginForm />
      <p className="text-center text-sm text-muted-foreground">
        Have an enrollment token?{" "}
        <Link className="text-foreground underline" href="/enroll">
          Create your passkey
        </Link>
      </p>
    </main>
  )
}
