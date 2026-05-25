import { cn } from "@/lib/utils";

// One header treatment for every page (see DESIGN_SYSTEM.md): bordered, an
// uppercase eyebrow, a clamped display title, and an optional right-aligned
// action. `children` renders below the title (countdowns, meta, etc.).
export function PageHeader({
  eyebrow,
  title,
  action,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "border-b border-border-default px-6 py-6 sm:px-12",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="font-body text-xs tracking-[0.2em] text-secondary uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.5rem)] leading-none tracking-wide uppercase">
            {title}
          </h1>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </header>
  );
}
