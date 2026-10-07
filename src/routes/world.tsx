import { createFileRoute } from "@tanstack/react-router";
import { WorldPage } from "@/components/world/world-page";

export const Route = createFileRoute("/world")({ component: WorldPage });
