"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Logout01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

export function LogoutButton() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function logout() {
    setIsPending(true)
    await fetch("/api/agent-auth/logout", { method: "POST" }).catch(() => null)
    router.push("/login")
    router.refresh()
  }

  return (
    <Button disabled={isPending} onClick={logout} variant="outline">
      {isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <HugeiconsIcon icon={Logout01Icon} data-icon="inline-start" />
      )}
      {isPending ? "Signing out…" : "Sign out"}
    </Button>
  )
}
