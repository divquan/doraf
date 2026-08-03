"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Logout01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

interface LogoutButtonProps {
  variant?: "outline" | "ghost" | "default" | "secondary" | "destructive" | "link"
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"
  showText?: boolean
  className?: string
}

export function LogoutButton({
  variant = "outline",
  size = "default",
  showText = true,
  className,
}: LogoutButtonProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function logout() {
    setIsPending(true)
    await fetch("/api/agent-auth/logout", { method: "POST" }).catch(() => null)
    router.push("/login")
    router.refresh()
  }

  return (
    <Button
      disabled={isPending}
      onClick={logout}
      variant={variant}
      size={size}
      className={className}
      aria-label="Sign out"
    >
      {isPending ? (
        <Spinner data-icon={showText ? "inline-start" : undefined} />
      ) : (
        <HugeiconsIcon icon={Logout01Icon} data-icon={showText ? "inline-start" : undefined} />
      )}
      {showText && (isPending ? "Signing out…" : "Sign out")}
    </Button>
  )
}
