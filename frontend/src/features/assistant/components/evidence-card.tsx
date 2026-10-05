"use client";
import { Network, BookOpen, Database } from "lucide-react";
import {
  summarize,
  number,
  percent,
  milliseconds,
} from "@/features/observability/domain/metrics";
import { Badge } from "@/shared/components/ui";
import type { Evidence } from "../domain/evidence";
export function EvidenceCard({ evidence }: { evidence: Evidence }) {
  const stats = summarize(
    evidence.hourly_metrics.filter((r) => r.service_id === evidence.service_id),
  );
  return (
    <div className="evidence-card">
      <div className="evidence-heading">
        <span className="evidence-avatar">
          <Database size={17} />
        </span>
        <div>
          <strong>{evidence.service_id} 분석 근거</strong>
          <small>
            {evidence.day} · {evidence.environment} · UTC
          </small>
        </div>
        <Badge tone="green">근거 조회</Badge>
      </div>
      <div className="evidence-stats">
        <div>
          <span>요청 수</span>
          <strong>{number(stats.requests)}</strong>
        </div>
        <div>
          <span>오류율</span>
          <strong>{percent(stats.errorRate)}</strong>
        </div>
        <div>
          <span>평균 지연</span>
          <strong>
            {stats.requests ? milliseconds(stats.average) : "데이터 없음"}
          </strong>
        </div>
      </div>
      <div className="evidence-section">
        <h3>
          <Network size={15} />
          서비스 관계
        </h3>
        <p>
          담당 팀 <strong>{evidence.topology.team}</strong>
        </p>
        <p>
          의존 서비스{" "}
          <strong>{evidence.topology.dependencies.join(", ") || "없음"}</strong>
        </p>
        <p>
          영향 가능 서비스{" "}
          <strong>
            {evidence.topology.potentially_affected.join(", ") || "없음"}
          </strong>
        </p>
      </div>
      <div className="evidence-section">
        <h3>
          <BookOpen size={15} />
          관련 운영 문서
        </h3>
        {evidence.runbooks.length ? (
          evidence.runbooks.map((r) => (
            <details key={r.id}>
              <summary>{r.title}</summary>
              <p>{r.content}</p>
            </details>
          ))
        ) : (
          <p>연결된 운영 문서가 없습니다.</p>
        )}
      </div>
      <div className="evidence-limitations">
        {evidence.limitations.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
      <div className="evidence-sources">
        출처 · {evidence.sources.join(" / ")}
      </div>
    </div>
  );
}
