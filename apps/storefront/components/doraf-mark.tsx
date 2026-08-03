import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon } from "@hugeicons/core-free-icons"

export function DorafMark({ variant = "agent" }: { variant?: "agent" | "buyer" }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-heading text-lg font-semibold tracking-tight">
          Doraf
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
