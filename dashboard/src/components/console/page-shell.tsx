import { cn } from "@/lib/utils";

/**
 * Every console page sits on the same container + gutters (§5) so vertical
 * edges line up across routes.
 */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-7xl px-6 py-8 lg:px-10 lg:py-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0">
        {eyebrow && <p className="text-eyebrow text-primary">{eyebrow}</p>}
        <h1
          className={cn(
            // Page titles use the H2 role: the fluid H1 display tier is for
            // marketing heroes, not a dense console (§3.3).
            "text-h2 text-balance",
            eyebrow && "mt-3",
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-lead text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}
