import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Custom variants per docs/files/DESIGN_SYSTEM.md — overrides shadcn's defaults.
// Signature: Bebas Neue, uppercase, tracked-out, hard corners (no rounded-*).
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-sm font-display text-sm uppercase tracking-wider whitespace-nowrap transition-colors duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-inverse hover:bg-accent-hover active:bg-accent-active",
        secondary:
          "bg-surface text-primary border border-border-default hover:border-border-strong",
        ghost: "text-secondary hover:bg-surface hover:text-primary",
        danger: "bg-danger text-primary hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-5",
        lg: "h-12 px-7 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
