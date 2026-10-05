import { NextResponse } from "next/server";
import { backend } from "@/shared/infrastructure/backend";
export async function GET() {
  const [core, agent] = await Promise.all([
    backend("core", "/readyz"),
    backend("agent", "/healthz"),
  ]);
  const agentData = await agent.json();
  return NextResponse.json({
    core: core.ok,
    agent: agent.ok,
    model_configured: agent.ok && !!agentData.model_configured,
  });
}
