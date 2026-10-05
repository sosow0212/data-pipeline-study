"use client";
import { useState } from "react";
import useSWR from "swr";
import {
  Network,
  Layers3,
  ChevronRight,
  Users,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { useWorkspace } from "@/shared/components/workspace";
import { PageTitle, Panel, LoadState, Badge } from "@/shared/components/ui";
import { fetchJSON } from "@/shared/application/api";
import { EvidenceCard } from "@/features/assistant/components/evidence-card";
import type { Evidence } from "@/features/assistant/domain/evidence";

export function Topology() {
  const ws = useWorkspace();
  const [selected, setSelected] = useState("checkout");
  const current = ws.services.find((s) => s.id === selected);
  const payload = {
    service_id: selected,
    day: ws.day,
    environment: ws.environment,
    question: "timeout latency dependency",
  };
  const { data, error, isLoading, mutate } = useSWR(
    ws.services.length
      ? ["topology", selected, ws.day, ws.environment, ws.refresh]
      : null,
    () =>
      fetchJSON<Evidence>("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    { revalidateOnFocus: false },
  );
  // Compute ranks from catalog edges; unknown services work without editing a fixed node list.
  const ranks = new Map(ws.services.map((s) => [s.id, 0]));
  for (let i = 0; i < ws.services.length; i++)
    for (const s of ws.services)
      for (const dep of s.dependencies || [])
        if (ranks.has(dep))
          ranks.set(
            dep,
            Math.min(
              ws.services.length - 1,
              Math.max(ranks.get(dep)!, ranks.get(s.id)! + 1),
            ),
          );
  const maxRank = Math.max(0, ...ranks.values());
  const columns = Array.from({ length: maxRank + 1 }, (_, rank) =>
    ws.services.filter((s) => ranks.get(s.id) === rank),
  );
  const height = Math.max(
    340,
    Math.max(0, ...columns.map((c) => c.length)) * 115 + 80,
  );
  const width = Math.max(650, columns.length * 230);
  const positions = new Map(
    columns.flatMap((column, rank) =>
      column.map(
        (s, index) =>
          [
            s.id,
            {
              x: 35 + rank * ((width - 235) / (maxRank || 1)),
              y: height / 2 + (index - (column.length - 1) / 2) * 115 - 35,
            },
          ] as const,
      ),
    ),
  );
  return (
    <>
      <PageTitle
        eyebrow="SERVICE ONTOLOGY"
        title="서비스 관계"
        description="의존 관계를 따라가며 오류가 영향을 줄 수 있는 범위를 살펴보세요."
        action={
          <span className="count-chip">
            <Network size={13} />
            {ws.services.reduce(
              (sum, s) => sum + (s.dependencies?.length || 0),
              0,
            )}{" "}
            dependencies
          </span>
        }
      />
      <div className="topology-layout">
        <Panel
          title="서비스 의존 관계"
          subtitle="Core 서비스 카탈로그 · 화살표는 호출하는 방향을 나타냅니다."
          action={<Badge tone="green">Service graph</Badge>}
        >
          {ws.servicesError ? (
            <LoadState error={ws.servicesError} onRetry={ws.reload} />
          ) : !ws.services.length ? (
            <LoadState
              loading={ws.servicesLoading}
              empty="서비스 카탈로그에 등록된 서비스가 없습니다."
            />
          ) : (
            <div className="graph-scroll">
              <div className="graph-canvas" style={{ width, height }}>
                <svg width={width} height={height} aria-hidden="true">
                  <defs>
                    <marker
                      id="graphArrow"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#c4d4ce" />
                    </marker>
                  </defs>
                  {ws.services.flatMap((s) =>
                    (s.dependencies || []).map((dep) => {
                      const a = positions.get(s.id),
                        b = positions.get(dep);
                      if (!a || !b) return null;
                      return (
                        <path
                          key={`${s.id}-${dep}`}
                          d={`M ${a.x + 165} ${a.y + 36} C ${a.x + 195} ${a.y + 36}, ${b.x - 32} ${b.y + 36}, ${b.x - 5} ${b.y + 36}`}
                          fill="none"
                          stroke={
                            selected === s.id || selected === dep
                              ? "#87b6a5"
                              : "#d6e1de"
                          }
                          strokeWidth={1.6}
                          markerEnd="url(#graphArrow)"
                        />
                      );
                    }),
                  )}
                </svg>
                {ws.services.map((s) => {
                  const pos = positions.get(s.id)!;
                  return (
                    <button
                      key={s.id}
                      className={`graph-node ${selected === s.id ? "selected" : ""}`}
                      style={{ left: pos.x, top: pos.y }}
                      onClick={() => setSelected(s.id)}
                      aria-label={`${s.id} 관계 조회`}
                      aria-pressed={selected === s.id}
                    >
                      <span className={`service-symbol ${s.id}`}>
                        <Layers3 size={16} />
                      </span>
                      <span>
                        <strong>{s.id}</strong>
                        <small>{s.team}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="table-foot">
            <span>
              노드를 선택하면 Neo4j에서 관계와 운영 문서를 조회합니다.
            </span>
            <span>DEPENDS_ON</span>
          </div>
        </Panel>
        <Panel
          title="선택한 서비스"
          subtitle="서비스 카탈로그에서 확인한 등록 정보"
        >
          <div className="selected-service">
            <span className={`service-symbol ${selected}`}>
              <Layers3 size={22} />
            </span>
            <h3>{current?.name || selected}</h3>
            <p className="muted">{selected}</p>
            <div className="service-property">
              <Users size={15} />
              <span>담당 팀</span>
              <strong>{current?.team || "—"}</strong>
            </div>
            <div className="service-property">
              <Network size={15} />
              <span>직접 의존</span>
              <strong>{current?.dependencies?.length || 0}개</strong>
            </div>
            <div className="dependency-list">
              {current?.dependencies?.map((id) => (
                <button key={id} onClick={() => setSelected(id)}>
                  {id}
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
            <Link
              className="button secondary"
              href={`/logs?service=${selected}`}
            >
              서비스 로그 보기 <ArrowUpRight size={15} />
            </Link>
          </div>
        </Panel>
      </div>
      <div className="topology-evidence">
        {error || isLoading ? (
          <Panel title="온톨로지 분석 근거">
            <LoadState
              error={error}
              loading={isLoading}
              onRetry={() => mutate()}
            />
          </Panel>
        ) : (
          data && <EvidenceCard evidence={data} />
        )}
      </div>
    </>
  );
}
