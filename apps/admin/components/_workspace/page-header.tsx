import { cn } from "@workspace/ui/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  /** Optional action area rendered on the trailing side (e.g. buttons). */
  actions?: React.ReactNode
  className?: string
}

/**
 * Shared workspace page header. Renders a consistent page title, optional
 * description, and an optional trailing action area. Server component — no
 * client hooks.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className
      )}
    >
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
