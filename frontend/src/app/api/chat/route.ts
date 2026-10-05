import { analysis } from "@/shared/infrastructure/backend";
export function POST(request: Request) {
  return analysis(request, "/v1/chat");
}
