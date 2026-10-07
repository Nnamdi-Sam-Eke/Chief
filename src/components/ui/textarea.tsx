import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-24 w-full rounded-[var(--radius-lg)] bg-surface-2 px-3 py-2.5 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle",
      "transition-[box-shadow] duration-[var(--motion-quick)]",
      "focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--color-border-strong),0_0_0_4px_color-mix(in_oklab,var(--color-primary)_22%,transparent)]",
      "disabled:opacity-40",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
