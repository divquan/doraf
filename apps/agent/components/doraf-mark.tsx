export function DorafMark({ variant = "agent" }: { variant?: "agent" | "buyer" }) {
  return <DashcheckerMark variant={variant} />
}

export function DashcheckerMark({ variant = "agent" }: { variant?: "agent" | "buyer" }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-xl overflow-hidden bg-[#fafafa] border border-border shadow-sm">
        <img
          src="/logo.jpg"
          alt="Dashchecker Icon"
          className="size-12 max-w-none -translate-y-1.5 object-cover"
        />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-heading text-lg font-semibold tracking-tight">
          Dashchecker
        </span>
        {variant === "agent" && (
          <span className="text-[0.68rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Agent
          </span>
        )}
      </div>
    </div>
  )
}


