import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PresenceOrb } from "@/components/presence/orb";
import { LOOP } from "@/components/status";
import { useCompanion } from "@/lib/companion/store";
import { cn } from "@/lib/utils";

export function Onboarding() {
  const complete = useCompanion((s) => s.completeOnboarding);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [name, setName] = useState("");

  if (step === 0) {
    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-bg px-6">
        <div className="grain pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex w-full max-w-lg flex-col items-center text-center">
          <PresenceOrb size="lg" className="rise mb-8" />
          <p className="rise text-xs tracking-[0.28em] text-muted uppercase" style={{ animationDelay: "80ms" }}>
            Operating partner
          </p>
          <h1
            className="rise mt-4 font-display text-5xl leading-none text-fg sm:text-6xl"
            style={{ animationDelay: "140ms" }}
          >
            Chief
          </h1>
          <p
            className="rise mt-5 max-w-md text-base leading-relaxed text-muted"
            style={{ animationDelay: "220ms" }}
          >
            Not a chatbot. A persistent partner that observes, remembers, reasons,
            and — when you allow it — acts.
          </p>
          <ol
            className="rise mt-10 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[0.7rem] tracking-[0.18em] text-subtle uppercase"
            style={{ animationDelay: "320ms" }}
          >
            {LOOP.map((stage, i) => (
              <li key={stage} className="flex items-center gap-4">
                {i > 0 && <span className="hidden text-border-strong sm:inline">/</span>}
                {stage}
              </li>
            ))}
          </ol>
          <Button className="rise mt-12 min-w-44" onClick={() => setStep(1)} style={{ animationDelay: "420ms" }}>
            Continue
            <ArrowRight />
          </Button>
        </div>
      </main>
    );
  }

  if (step === 1) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6">
        <div className="w-full max-w-md">
          <p className="text-xs tracking-[0.28em] text-muted uppercase">Identity</p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-fg">What should I call you?</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            I’ll use this across briefings, commitments, and the world model.
          </p>
          <form
            className="mt-8 space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) setStep(2);
            }}
          >
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              aria-label="Your name"
            />
            <Button type="submit" disabled={!name.trim()} className="w-full">
              Next
              <ArrowRight />
            </Button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 py-12">
      <div className="w-full max-w-lg">
        <p className="text-xs tracking-[0.28em] text-muted uppercase">World model</p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-fg">How should we begin?</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A living workspace is already modeled — projects, decisions, commitments,
          the income-versus-polish tension. Or start empty and I’ll learn from you.
        </p>
        <div className="mt-8 grid gap-3">
          <Choice
            title="Enter the living workspace"
            body="Load the spec world: DataPilot, Cognivis, Clariva, portfolio, job search, and the WIS thesis."
            onClick={() => complete(name, "spec")}
            featured
          />
          <Choice
            title="Start from zero"
            body="Blank memory. You tell me who you are and what you’re building."
            onClick={() => complete(name, "blank")}
          />
        </div>
      </div>
    </main>
  );
}

function Choice({
  title,
  body,
  onClick,
  featured,
}: {
  title: string;
  body: string;
  onClick: () => void;
  featured?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[var(--radius-xl)] p-5 text-left shadow-[var(--shadow-border)] transition-[box-shadow,background-color] duration-[var(--motion-quick)] hover:shadow-[var(--shadow-border-hover)]",
        featured ? "bg-surface-2" : "bg-surface",
      )}
    >
      <div className="font-medium text-fg">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </button>
  );
}
