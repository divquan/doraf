"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"

export type LegalSection = readonly [id: string, title: string]

export function LegalSectionNav({
  label,
  sections,
}: {
  label: string
  sections: readonly LegalSection[]
}) {
  const [activeId, setActiveId] = useState(sections[0]?.[0] ?? "")
  const pendingIdRef = useRef<string | null>(null)

  useEffect(() => {
    const targets = sections
      .map(([id]) => document.getElementById(id))
      .filter((target): target is HTMLElement => target !== null)

    if (!targets.length) {
      return
    }

    const visibility = new Map<string, number>()
    const settlePendingTarget = () => {
      const pendingId = pendingIdRef.current
      if (!pendingId) {
        return
      }

      const target = targets.find((section) => section.id === pendingId)
      if (!target) {
        pendingIdRef.current = null
        return
      }

      const targetBounds = target.getBoundingClientRect()
      const activationLine = Math.max(48, window.innerHeight * 0.12)

      if (
        targetBounds.top <= activationLine &&
        targetBounds.bottom >= activationLine
      ) {
        pendingIdRef.current = null
        setActiveId(pendingId)
      }
    }

    const updateActiveSection = () => {
      if (pendingIdRef.current) {
        settlePendingTarget()
        return
      }

      const next = targets
        .map((target, index) => ({
          id: target.id,
          index,
          ratio: visibility.get(target.id) ?? 0,
          top: target.getBoundingClientRect().top,
        }))
        .filter((target) => target.ratio > 0)
        .sort((a, b) => {
          if (Math.abs(a.ratio - b.ratio) > 0.05) {
            return b.ratio - a.ratio
          }

          return a.top - b.top || a.index - b.index
        })[0]

      if (next) {
        setActiveId(next.id)
      }
    }

    const releasePendingNavigation = () => {
      if (!pendingIdRef.current) {
        return
      }

      pendingIdRef.current = null
      updateActiveSection()
      window.requestAnimationFrame(updateActiveSection)
    }

    const handleKeyboardScroll = (event: KeyboardEvent) => {
      if (
        [
          "ArrowDown",
          "ArrowUp",
          "End",
          "Home",
          "PageDown",
          "PageUp",
          " ",
        ].includes(event.key)
      ) {
        releasePendingNavigation()
      }
    }

    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                visibility.set(
                  entry.target.id,
                  entry.isIntersecting ? entry.intersectionRatio : 0
                )
              }

              updateActiveSection()
            },
            {
              rootMargin: "-12% 0px -70% 0px",
              threshold: [0, 0.01, 0.2, 0.5, 1],
            }
          )
        : null

    targets.forEach((target) => observer?.observe(target))
    window.addEventListener("scroll", settlePendingTarget, { passive: true })
    window.addEventListener("wheel", releasePendingNavigation, {
      passive: true,
    })
    window.addEventListener("touchstart", releasePendingNavigation, {
      passive: true,
    })
    window.addEventListener("pointerdown", releasePendingNavigation, {
      passive: true,
    })
    window.addEventListener("keydown", handleKeyboardScroll)

    return () => {
      observer?.disconnect()
      window.removeEventListener("scroll", settlePendingTarget)
      window.removeEventListener("wheel", releasePendingNavigation)
      window.removeEventListener("touchstart", releasePendingNavigation)
      window.removeEventListener("pointerdown", releasePendingNavigation)
      window.removeEventListener("keydown", handleKeyboardScroll)
    }
  }, [sections])

  const handleSectionClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    event.preventDefault()
    pendingIdRef.current = id

    const target = document.getElementById(id)
    if (!target) {
      pendingIdRef.current = null
      return
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    })
    window.history.replaceState(null, "", "#" + id)

    window.requestAnimationFrame(() => {
      if (pendingIdRef.current !== id) {
        return
      }

      const targetBounds = target.getBoundingClientRect()
      const activationLine = Math.max(48, window.innerHeight * 0.12)

      if (
        targetBounds.top <= activationLine &&
        targetBounds.bottom >= activationLine
      ) {
        pendingIdRef.current = null
        setActiveId(id)
      }
    })
  }

  return (
    <nav aria-label={label} className="pb-4 lg:mt-4 lg:pb-0">
      <ol className="space-y-1 border-l border-border/80 pl-2 text-sm">
        {sections.map(([id, title], index) => {
          const isActive = activeId === id

          return (
            <li key={id}>
              <a
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "group relative inline-flex min-h-9 w-full items-center rounded-lg px-2 text-muted-foreground transition-[color,font-weight] duration-200 focus-visible:text-foreground focus-visible:outline-none",
                  "hover:text-foreground",
                  isActive && "font-medium text-foreground"
                )}
                href={"#" + id}
                onClick={(event) => handleSectionClick(event, id)}
              >
                <span
                  aria-hidden="true"
                  className="mr-2 flex size-4 shrink-0 items-center justify-center"
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full transition-[background-color,opacity] duration-200",
                      isActive
                        ? "bg-primary opacity-100"
                        : "bg-muted-foreground/40 opacity-60 group-hover:opacity-100"
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "transition-[color,font-weight] duration-200",
                    isActive && "font-medium"
                  )}
                >
                  <span
                    className={cn(
                      "mr-2 font-mono text-[10px] text-muted-foreground/60 tabular-nums",
                      isActive && "text-primary"
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {title}
                </span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
