import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? <p className="text-eyebrow text-muted-foreground">{eyebrow}</p> : null}
        {/* leading-none so the title's optical top edge lines up with the
            main canvas padding — the default line box adds half-leading above
            the cap height and reads as extra top inset. */}
        <h1 className="font-heading text-2xl font-semibold leading-none tracking-tight lg:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
