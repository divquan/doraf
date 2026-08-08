import { CheckmarkCircle02Icon, Copy01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

function Secret({
  copied,
  label,
  onCopy,
  value,
  valueClassName,
}: {
  copied: boolean
  label: string
  onCopy: () => void
  value: string
  valueClassName?: string
}) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 flex items-center justify-between gap-2">
        <span
          className={cn(
            "min-w-0 font-mono text-base font-semibold break-all",
            valueClassName
          )}
        >
          {value}
        </span>
        <Button
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={onCopy}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {copied ? (
            <HugeiconsIcon icon={CheckmarkCircle02Icon} />
          ) : (
            <HugeiconsIcon icon={Copy01Icon} />
          )}
        </Button>
      </dd>
    </div>
  )
}

export { Secret }
