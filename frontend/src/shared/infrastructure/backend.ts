import "server-only";
import { NextResponse } from "next/server";

export async function backend(
  service: "core" | "agent",
  path: string,
  init: RequestInit = {},
) {
  const origin =
    service === "core"
      ? process.env.CORE_URL || "http://localhost:18090"
      : process.env.AGENT_URL || "http://localhost:18092";
  try {
    const response = await fetch(new URL(path, origin), {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(path === "/v1/chat" ? 90000 : 45000),
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        detail: `${service === "core" ? "Core" : "Agent"}에 연결할 수 없습니다. 로컬 서비스 실행 상태를 확인해 주세요.`,
      },
      { status: 503 },
    );
  }
}
export function query(request: Request, allowed: string[]) {
  const params = new URL(request.url).searchParams;
  const selected = new URLSearchParams();
  for (const key of allowed)
    if (params.has(key)) selected.set(key, params.get(key)!);
  return selected.toString();
}
export async function analysis(request: Request, path: string) {
  const text = await request.text();
  if (text.length > 10000)
    return NextResponse.json(
      { detail: "질문이 너무 깁니다." },
      { status: 413 },
    );
  try {
    JSON.parse(text);
  } catch {
    return NextResponse.json(
      { detail: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }
  return backend("agent", path, { method: "POST", body: text });
}
