import { createFileRoute } from "@tanstack/react-router";
import { ProjectDetail } from "@/components/work/project-detail";

export const Route = createFileRoute("/work/$id")({
  component: WorkDetailRoute,
});

function WorkDetailRoute() {
  const { id } = Route.useParams();
  return <ProjectDetail id={id} />;
}
