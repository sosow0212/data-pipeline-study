import { backend } from "@/shared/infrastructure/backend";
export function GET() {
  return backend("core", "/v1/services");
}
