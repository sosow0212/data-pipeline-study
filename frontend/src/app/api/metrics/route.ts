import { backend, query } from "@/shared/infrastructure/backend";
export function GET(request: Request) {
  return backend(
    "agent",
    `/v1/metrics?${query(request, ["day", "environment"])}`,
  );
}
