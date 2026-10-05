import { backend, query } from "@/shared/infrastructure/backend";
export function GET(request: Request) {
  return backend(
    "core",
    `/v1/events?${query(request, ["day", "environment", "service_id", "level", "search", "page", "limit"])}`,
  );
}
