export function DorafMark({ variant = "agent" }: { variant?: "agent" | "buyer" | "icon" }) {
  return <DashcheckerMark variant={variant} />
}

export function DashcheckerMark({ variant = "agent" }: { variant?: "agent" | "buyer" | "icon" }) {
  if (variant === "icon") {
    return (
      <img
        src="/logo.jpg"
        alt="Dashchecker Mark"
        className="h-9 w-auto object-contain mix-blend-multiply dark:mix-blend-normal"
      />
    )
  }

  return (
    <div className="flex items-center gap-2 select-none">
      <img
        src="/logo.jpg"
        alt="Dashchecker Logo"
        className="h-8 w-auto object-contain mix-blend-multiply dark:mix-blend-normal"
      />
      {variant === "agent" && (
        <span className="text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted/60 border border-border/50">
          Agent
        </span>
      )}
    </div>
  )
}




