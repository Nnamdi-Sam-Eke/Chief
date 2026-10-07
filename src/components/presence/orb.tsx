import { cn } from "@/lib/utils";
import type { PresenceState } from "@/lib/companion/types";

const labels: Record<PresenceState, string> = {
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

export function PresenceOrb({
  state = "idle",
  size = "md",
  className,
}: {
  state?: PresenceState;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "orb",
        size === "sm" && "size-12",
        size === "lg" && "size-16",
        className,
      )}
      data-state={state}
      aria-label={`Chief is ${labels[state]}`}
      role="img"
    >
      <span className="orb-ring" />
      <span className="orb-core" />
    </div>
  );
}
