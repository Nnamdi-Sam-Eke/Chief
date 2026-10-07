import { useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { commitmentTone } from "@/components/status";
import { useCompanion } from "@/lib/companion/store";
import { sendDraftedEmail } from "@/lib/actions/send-email";
import { cn } from "@/lib/utils";
import type { MemoryKind } from "@/lib/companion/types";
import { toast } from "sonner";

const TABS = ["decisions", "commitments", "ideas", "memory", "drafts"] as const;
type Tab = (typeof TABS)[number];

function fmt(iso: string) {
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

export function MemoryPage() {
  const world = useCompanion();
  const [tab, setTab] = useState<Tab>("decisions");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs tracking-[0.28em] text-muted uppercase">Vault</p>
        <h1 className="mt-2 font-display text-4xl">Memory</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          You own this. Inspect, correct, or remove anything Chief has stored.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </div>

      {tab === "decisions" && (
        <List empty="No decisions yet.">
          {world.decisions.map((d) => (
            <Card key={d.id} onRemove={() => world.remove("decisions", d.id)}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{d.status}</Badge>
                <span className="text-xs text-subtle">{fmt(d.date)}</span>
              </div>
              <h3 className="mt-2 font-medium">{d.statement}</h3>
              <p className="mt-1 text-sm text-muted">Why: {d.why}</p>
              {d.alternatives.length > 0 && (
                <p className="mt-2 text-xs text-subtle">Considered: {d.alternatives.join(" / ")}</p>
              )}
            </Card>
          ))}
        </List>
      )}

      {tab === "commitments" && (
        <List empty="No commitments tracked.">
          {world.commitments.map((c) => (
            <Card key={c.id} onRemove={() => world.remove("commitments", c.id)}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">{c.title}</h3>
                <Badge tone={commitmentTone(c.status)}>{c.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-subtle">
                {c.owner}
                {c.due ? ` · due ${fmt(c.due)}` : ""}
              </p>
              {c.status === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => world.upsertCommitment({ ...c, status: "done" })}
                >
                  Mark done
                </Button>
              )}
            </Card>
          ))}
        </List>
      )}

      {tab === "ideas" && (
        <List empty="No ideas captured.">
          {world.ideas.map((idea) => (
            <Card key={idea.id} onRemove={() => world.remove("ideas", idea.id)}>
              <div className="flex items-center gap-2">
                <Badge>{idea.status}</Badge>
                <span className="text-xs text-subtle">{fmt(idea.created)}</span>
              </div>
              <h3 className="mt-2 font-medium">{idea.title}</h3>
              <p className="mt-1 text-sm text-muted">{idea.description}</p>
            </Card>
          ))}
        </List>
      )}

      {tab === "memory" && <MemoryList />}
      {tab === "drafts" && <DraftsList />}
    </div>
  );
}

function DraftsList() {
  const world = useCompanion();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function copy(id: string, body: string) {
    try {
      await navigator.clipboard.writeText(body);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    } catch {
      /* clipboard unavailable — the text is still visible to select manually */
    }
  }

  async function send(draft: { id: string; to?: string; subject?: string; body: string; title: string }) {
    if (!draft.to) return;
    setSendingId(draft.id);
    try {
      const res = await sendDraftedEmail({
        data: { to: draft.to, subject: draft.subject || draft.title, body: draft.body },
      });
      if (res.ok) {
        world.remove("drafts", draft.id);
        world.addMemory({
          kind: "episodic",
          content: `Sent email to ${draft.to}: ${draft.subject || draft.title}`,
          source: "action",
          confidence: "fact",
          tags: ["email"],
        });
        toast("Email sent.");
      } else {
        toast(`Couldn't send: ${res.error}`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't send email.");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <List empty="Nothing prepared yet. Chief drafts things here once a category's permission is at 'prepare' or higher.">
      {world.drafts.map((d) => (
        <Card key={d.id} onRemove={() => world.remove("drafts", d.id)}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{d.kind}</Badge>
            <span className="text-xs text-subtle">{fmt(d.created)}</span>
          </div>
          <h3 className="mt-2 font-medium">{d.title}</h3>
          {d.kind === "email" && d.to && <p className="mt-1 text-xs text-subtle">To: {d.to}</p>}
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{d.body}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => copy(d.id, d.body)}>
              {copiedId === d.id ? "Copied" : "Copy"}
            </Button>
            {d.kind === "email" && d.to && (
              <Button size="sm" onClick={() => void send(d)} disabled={sendingId === d.id}>
                {sendingId === d.id ? "Sending…" : "Send"}
              </Button>
            )}
          </div>
        </Card>
      ))}
    </List>
  );
}

function MemoryList() {
  const world = useCompanion();
  const [kind, setKind] = useState<MemoryKind | "all">("all");
  const kinds: Array<MemoryKind | "all"> = [
    "all",
    "episodic",
    "semantic",
    "procedural",
    "preference",
    "relationship",
  ];
  const items = world.memories.filter((m) => kind === "all" || m.kind === kind);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "h-9 rounded-full px-3 text-xs",
              kind === k ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted",
            )}
          >
            {k}
          </button>
        ))}
      </div>
      <List empty="Memory is empty.">
        {items
          .slice()
          .reverse()
          .map((m) => (
            <Card key={m.id} onRemove={() => world.remove("memories", m.id)}>
              <div className="flex flex-wrap gap-2">
                <Badge>{m.kind}</Badge>
                <Badge>{m.confidence}</Badge>
              </div>
              <p className="mt-2 text-sm">{m.content}</p>
              <p className="mt-2 text-xs text-subtle">
                {m.source} · {fmt(m.created)}
              </p>
            </Card>
          ))}
      </List>
    </div>
  );
}

function List({ children, empty }: { children: ReactNode; empty: string }) {
  const arr = Array.isArray(children) ? children : [children];
  if (arr.filter(Boolean).length === 0) {
    return <p className="text-sm text-muted">{empty}</p>;
  }
  return <div className="space-y-3">{children}</div>;
}

function Card({
  children,
  onRemove,
}: {
  children: ReactNode;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)]">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="mt-3 text-xs text-subtle hover:text-danger"
      >
        Remove
      </button>
    </article>
  );
}