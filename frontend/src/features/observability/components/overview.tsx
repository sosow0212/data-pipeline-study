"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Layers3,
  Zap,
  Database,
} from "lucide-react";
import { useWorkspace } from "@/shared/components/workspace";
import { Badge, LoadState, PageTitle, Panel } from "@/shared/components/ui";
import { fetchJSON } from "@/shared/application/api";
import {
  summarize,
  timeline,
  number,
  percent,
  milliseconds,
  type MetricsResponse,
} from "../domain/metrics";
import { LatencyChart, TrafficChart } from "./charts";

export function Overview() {
  const ws = useWorkspace();
  const [selected, setSelected] = useState("payment");
  const { data, error, isLoading, mutate } = useSWR(
    [`/api/metrics?day=${ws.day}&environment=${ws.environment}`, ws.refresh],
    ([url]: [string, number]) => fetchJSON<MetricsResponse>(url),
    { revalidateOnFocus: false },
  );
  const rows = data?.hourly_metrics || [];
  const stats = summarize(rows);
  const grouped = ws.services.map((s) => ({
    ...s,
    ...summarize(rows.filter((r) => r.service_id === s.id)),
  }));
  const ranked = [...grouped]
    .filter((s) => s.requests)
    .sort((a, b) => b.errorRate - a.errorRate);
  const peak = timeline(rows)
    .filter((v) => v.requests)
    .sort((a, b) => b.errorRate - a.errorRate)[0];
  return (
    <>
      <PageTitle
        eyebrow="OBSERVABILITY"
        title="서비스 전체 현황"
        description="요청부터 오류까지, 서비스 상태를 한눈에 확인하세요."
        action={
          <Link className="button secondary" href="/logs">
            로그 탐색 <ArrowUpRight size={15} />
          </Link>
        }
      />
      {error || isLoading ? (
        <Panel title="서비스 지표">
          <LoadState
            error={error}
            loading={isLoading}
            onRetry={() => mutate()}
          />
        </Panel>
      ) : (
        <>
          {data?.truncated && (
            <div className="inline-alert" role="alert">
              지표가 2,400행을 초과했습니다. 아래 수치는 일부 데이터만
              반영합니다.
            </div>
          )}
          <div className="stats-grid">
            {[
              {
                label: "전체 요청",
                value: number(stats.requests),
                unit: "건",
                icon: Activity,
                note: "선택한 날짜의 요청 수",
                color: "green",
              },
              {
                label: "오류 요청",
                value: number(stats.errors),
                unit: "건",
                icon: AlertTriangle,
                note: "HTTP 5xx 응답",
                color: "orange",
              },
              {
                label: "오류율",
                value: percent(stats.errorRate),
                unit: "",
                icon: Zap,
                note: "오류 요청 / 전체 요청",
                color: "orange",
              },
              {
                label: "평균 응답 시간",
                value: rows.length ? String(Math.round(stats.average)) : "—",
                unit: "ms",
                icon: Clock3,
                note: "요청 수로 가중한 평균",
                color: "purple",
              },
            ].map(({ label, value, unit, icon: Icon, note, color }) => (
              <section key={label} className="stat-card">
                <div className="stat-top">
                  <span>{label}</span>
                  <span className={`stat-icon ${color}`}>
                    <Icon size={17} />
                  </span>
                </div>
                <div className="stat-value">
                  {value}
                  <small>{unit}</small>
                </div>
                <p>{note}</p>
              </section>
            ))}
          </div>
          {!rows.length ? (
            <Panel title="아직 집계된 데이터가 없습니다">
              <LoadState empty="날짜와 환경을 확인하거나, 로그를 적재한 뒤 집계 작업을 실행해 주세요." />
            </Panel>
          ) : (
            <>
              <div className="charts-grid">
                <Panel
                  title="시간별 트래픽"
                  subtitle="하루 동안 들어온 요청과 오류를 비교합니다."
                  action={
                    <div className="legend">
                      <span>
                        <i className="green-dot" />
                        요청
                      </span>
                      <span>
                        <i className="orange-dot" />
                        오류
                      </span>
                    </div>
                  }
                >
                  <TrafficChart rows={rows} />
                  <div className="chart-foot">
                    <span>00:00 – 23:00 UTC</span>
                    <span>시간별 집계 · {number(stats.requests)}건</span>
                  </div>
                </Panel>
                <Panel
                  title="응답 지연"
                  subtitle="선택한 서비스의 시간별 지연 · ms"
                  action={
                    <select
                      aria-label="지연 그래프 서비스"
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {ws.services.map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.id}
                        </option>
                      ))}
                    </select>
                  }
                >
                  <LatencyChart
                    rows={rows.filter((r) => r.service_id === selected)}
                  />
                  <div className="chart-foot">
                    <div className="legend">
                      <span>
                        <i className="purple-dot" />
                        p95
                      </span>
                      <span>
                        <i className="gray-dot" />
                        평균
                      </span>
                    </div>
                    <span>상위 지연 구간 확인</span>
                  </div>
                </Panel>
              </div>
              <div className="insight-strip">
                <span className="insight-icon">
                  <AlertTriangle size={19} />
                </span>
                <div>
                  <strong>{ranked[0]?.id}의 오류율이 가장 높습니다.</strong>
                  <p>
                    서비스 오류율 {percent(ranked[0]?.errorRate || 0)} · 전체
                    오류율은 {peak?.hour}에 {percent(peak?.errorRate || 0)}로
                    가장 높았습니다.
                  </p>
                </div>
                <Link href="/assistant" className="text-link">
                  분석 근거 확인 <ArrowRight size={15} />
                </Link>
              </div>
              <Panel
                title="서비스별 상태"
                subtitle="서비스별 요청량과 응답 지연을 비교합니다."
                action={
                  <span className="count-chip">
                    <Layers3 size={13} />
                    {ws.services.length} services
                  </span>
                }
              >
                <div className="table-scroll">
                  <table className="data-table services-table">
                    <thead>
                      <tr>
                        <th>서비스</th>
                        <th>담당 팀</th>
                        <th className="numeric">요청 수</th>
                        <th className="numeric">오류율</th>
                        <th className="numeric">평균 응답</th>
                        <th className="numeric">최대 시간별 p95</th>
                        <th>관측 상태</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {grouped.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <Link
                              href={`/logs?service=${s.id}`}
                              className="service-name"
                            >
                              <span className={`service-symbol ${s.id}`}>
                                <Layers3 size={15} />
                              </span>
                              {s.id}
                            </Link>
                          </td>
                          <td>
                            <span className="muted">{s.team}</span>
                          </td>
                          <td className="numeric">{number(s.requests)}</td>
                          <td
                            className={`numeric ${s.errorRate >= 0.05 ? "warning-text" : ""}`}
                          >
                            {percent(s.errorRate)}
                          </td>
                          <td className="numeric">
                            {s.requests ? milliseconds(s.average) : "—"}
                          </td>
                          <td className="numeric">
                            {s.requests ? milliseconds(s.peakHourlyP95) : "—"}
                          </td>
                          <td>
                            <Badge
                              tone={
                                !s.requests
                                  ? "neutral"
                                  : s.errorRate >= 0.05
                                    ? "orange"
                                    : "green"
                              }
                            >
                              {!s.requests
                                ? "데이터 없음"
                                : s.errorRate >= 0.05
                                  ? "확인 필요"
                                  : "양호"}
                            </Badge>
                          </td>
                          <td>
                            <Link
                              href={`/logs?service=${s.id}`}
                              aria-label={`${s.id} 로그 보기`}
                              className="row-action"
                            >
                              <ArrowUpRight size={16} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-foot">
                  <span>확인 필요: 일별 오류율 5% 이상</span>
                  <span>p95는 시간별 값 중 최댓값입니다.</span>
                </div>
              </Panel>
            </>
          )}
          {ws.servicesError && (
            <LoadState error={ws.servicesError} onRetry={ws.reload} />
          )}
          <div className="source-note">
            <Database size={14} />
            <span>
              Iceberg Gold ·{" "}
              {data?.aggregated_at
                ? `마지막 집계 ${new Date(data.aggregated_at).toLocaleString("ko-KR", { timeZone: "UTC", hour12: false })} UTC`
                : "집계 시점 없음"}
            </span>
            <span>새로고침은 저장된 집계를 다시 조회합니다.</span>
          </div>
        </>
      )}
    </>
  );
}
