import { createFileRoute } from "@tanstack/react-router";
import { CommandPage } from "@/components/command/command-page";

export const Route = createFileRoute("/")({ component: CommandPage });
