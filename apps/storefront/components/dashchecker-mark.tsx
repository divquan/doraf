export function DashcheckerMark({
  variant = "agent",
}: {
  variant?: "agent" | "buyer" | "icon"
}) {
  return <DashcheckerMarkBase variant={variant} />
}

function DashcheckerMarkBase({
  variant = "agent",
}: {
  variant?: "agent" | "buyer" | "icon"
}) {
  if (variant === "icon") {
    return (
      <div className="relative inline-flex items-center">
        <img
          src="/logo-mark.svg"
          alt="Dashchecker Mark"
          className="block h-[46.8px] w-auto object-contain"
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 select-none">
      <img
        src="/logo.svg"
        alt="Dashchecker Logo"
        className="block h-[41.6px] w-auto object-contain"
      />
      {variant === "agent" && (
        <span className="rounded border border-border/50 bg-muted/60 px-1.5 py-0.5 text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase">
          Agent
        </span>
      )}
    </div>
  )
}
