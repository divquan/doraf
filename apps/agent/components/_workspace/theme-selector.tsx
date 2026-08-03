"use client"

import { useTheme } from "next-themes"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Label } from "@workspace/ui/components/label"
import { useEffect, useState } from "react"

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTimeout(() => setMounted(true), 0)
  }, [])

  if (!mounted) {
    return (
      <div className="space-y-2">
        <Label htmlFor="theme-selector">Active Theme</Label>
        <NativeSelect id="theme-selector" value="system" disabled className="w-full">
          <NativeSelectOption value="system">System Preference</NativeSelectOption>
        </NativeSelect>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="theme-selector">Active Theme</Label>
      <NativeSelect
        id="theme-selector"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="w-full"
      >
        <NativeSelectOption value="system">System Preference</NativeSelectOption>
        <NativeSelectOption value="light">Light Mode</NativeSelectOption>
        <NativeSelectOption value="dark">Dark Mode</NativeSelectOption>
      </NativeSelect>
    </div>
  )
}
