import type { ComponentProps } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-surface-2 shadow-[var(--shadow-border)] transition-colors duration-[var(--motion-quick)] data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 translate-x-0.5 rounded-full bg-fg transition-transform duration-[var(--motion-quick)] data-[state=checked]:translate-x-[1.35rem] data-[state=checked]:bg-primary-fg" />
    </SwitchPrimitive.Root>
  );
}
