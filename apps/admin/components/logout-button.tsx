"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"

export function LogoutButton() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  async function logout() {
    setIsSubmitting(true)
    await fetch("/api/logout", { method: "POST" })
    router.replace("/login")
    router.refresh()
  }
  return (
    <Button
      disabled={isSubmitting}
      onClick={logout}
      type="button"
      variant="outline"
    >
      {isSubmitting ? "Signing out…" : "Sign out"}
    </Button>
  )
}
