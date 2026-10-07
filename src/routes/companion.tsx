import { createFileRoute } from "@tanstack/react-router";
import { CompanionPage } from "@/components/companion/companion-page";

export const Route = createFileRoute("/companion")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: CompanionRoute,
});

function CompanionRoute() {
  const { q } = Route.useSearch();
  return <CompanionPage preset={q} />;
}
