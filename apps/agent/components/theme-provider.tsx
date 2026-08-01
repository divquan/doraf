"use client"

import * as React from "react"

function ThemeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")

    function followSystemTheme(event: MediaQueryListEvent) {
      const savedTheme = localStorage.getItem("theme")
      if (savedTheme !== null && savedTheme !== "system") return
      applyTheme(event.matches ? "dark" : "light")
    }

    media.addEventListener("change", followSystemTheme)
    return () => media.removeEventListener("change", followSystemTheme)
  }, [])

  return (
    <>
      <ThemeHotkey />
      {children}
    </>
  )
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function ThemeHotkey() {
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (typeof event.key !== "string" || event.key.toLowerCase() !== "d") {
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      const nextTheme = document.documentElement.classList.contains("dark")
        ? "light"
        : "dark"
      localStorage.setItem("theme", nextTheme)
      applyTheme(nextTheme)
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  return null
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark")
  document.documentElement.style.colorScheme = theme
}

export { ThemeProvider }
