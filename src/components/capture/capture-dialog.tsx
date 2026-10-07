import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCompanion } from "@/lib/companion/store";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const kinds = [
  { id: "idea" as const, label: "Idea" },
  { id: "commitment" as const, label: "Commitment" },
  { id: "decision" as const, label: "Decision" },
  { id: "memory" as const, label: "Note" },
];

export function CaptureDialog({
  triggerClassName,
  compact,
}: {
  triggerClassName?: string;
  compact?: boolean;
}) {
  const capture = useCompanion((s) => s.capture);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof kinds)[number]["id"]>("idea");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  function submit() {
    if (!title.trim() && !body.trim()) return;
    capture(kind, { title: title.trim(), body: body.trim() });
    toast(`Captured ${kind}`);
    setTitle("");
    setBody("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={compact ? "ghost" : "outline"} size={compact ? "icon-sm" : "sm"} className={triggerClassName}>
          <Plus />
          {!compact && <span>Capture</span>}
          {compact && <span className="sr-only">Capture</span>}
        </Button>
      </DialogTrigger>
      <DialogContent title="Capture">
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <Button
              key={k.id}
              size="sm"
              variant={kind === k.id ? "default" : "outline"}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </Button>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === "decision" ? "We will…" : "Title"}
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={kind === "decision" ? "Why" : "Context"}
            rows={4}
          />
          <Button className="w-full" onClick={submit} disabled={!title.trim() && !body.trim()}>
            Save to world model
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
