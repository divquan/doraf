"use client"

import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { applyTheme } from "@/components/theme-provider"

type ThemeChoice = "light" | "dark" | "system"

function resolveStoredTheme(): ThemeChoice {
  if (typeof window === "undefined") return "system"
  const stored = localStorage.getItem("theme")
  return stored === "light" || stored === "dark" ? stored : "system"
}

export function ThemeSelector() {
  const [theme, setTheme] = useState<ThemeChoice>("system")

  useEffect(() => {
    setTheme(resolveStoredTheme())
  }, [])

  function select(next: ThemeChoice) {
    setTheme(next)
    if (next === "system") {
      localStorage.removeItem("theme")
      applyTheme(
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
      )
      return
    }
    localStorage.setItem("theme", next)
    applyTheme(next)
  }

  const options: Array<{ value: ThemeChoice; label: string }> = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ]

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Appearance</p>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/50 p-1">
        {options.map((option) => {
          const active = theme === option.value
          return (
            <Button
              aria-pressed={active}
              className={cn(
                "justify-center",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              key={option.value}
              onClick={() => select(option.value)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {option.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
