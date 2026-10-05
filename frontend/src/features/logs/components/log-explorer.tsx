"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  X,
  Copy,
  Check,
  ScrollText,
} from "lucide-react";
import { useWorkspace } from "@/shared/components/workspace";
import { Badge, LoadState, PageTitle, Panel } from "@/shared/components/ui";
import { fetchJSON } from "@/shared/application/api";
import { number } from "@/features/observability/domain/metrics";
import type { EventPage, LogEvent } from "../domain/event";

export function LogExplorer() {
  const ws = useWorkspace();
  const params = useSearchParams();
  const [service, setService] = useState(params.get("service") || "");
  const [level, setLevel] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LogEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setTerm(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [service, level, ws.day, ws.environment]);
  useEffect(() => {
    setService(params.get("service") || "");
  }, [params]);
  useEffect(() => {
    if (selected) {
      dialog.current?.showModal();
      setCopied(false);
    } else dialog.current?.close();
  }, [selected]);
  const query = new URLSearchParams({
    day: ws.day,
    environment: ws.environment,
    page: String(page),
    limit: "25",
    ...(service ? { service_id: service } : {}),
    ...(level ? { level } : {}),
    ...(term ? { search: term } : {}),
  });
  const { data, error, isLoading, mutate } = useSWR(
    [`/api/events?${query}`, ws.refresh],
    ([url]: [string, number]) => fetchJSON<EventPage>(url),
    { revalidateOnFocus: false },
  );
  const pages = data ? Math.ceil(data.total / data.limit) : 0;
  return (
    <>
      <PageTitle
        eyebrow="EVENT EXPLORER"
        title="로그 탐색"
        description="로그를 검색하고 요청 한 건의 발생 맥락을 확인하세요."
        action={
          <span className="count-chip">
            <ScrollText size={14} />
            {data ? `${number(data.total)} events` : "MongoDB"}
          </span>
        }
      />
      <Panel
        title="애플리케이션 로그"
        subtitle="Core에 저장된 원본 로그 · 최신 발생 시각순"
        action={<Badge tone="green">MongoDB</Badge>}
      >
        <div className="log-filters">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="로그 검색"
              placeholder="메시지, 경로, Trace ID 검색..."
              maxLength={200}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="clear-search"
                aria-label="검색어 지우기"
                onClick={() => setSearch("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <select
            aria-label="서비스 필터"
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            <option value="">모든 서비스</option>
            {ws.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}
              </option>
            ))}
          </select>
          <select
            aria-label="로그 수준 필터"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="">모든 수준</option>
            <option>INFO</option>
            <option>WARN</option>
            <option>ERROR</option>
          </select>
        </div>
        {error || isLoading ? (
          <LoadState
            error={error}
            loading={isLoading}
            onRetry={() => mutate()}
          />
        ) : !data?.items.length ? (
          <LoadState empty="현재 조건에 일치하는 로그가 없습니다. 날짜나 검색 조건을 변경해 주세요." />
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table logs-table">
                <thead>
                  <tr>
                    <th>발생 시각 · UTC</th>
                    <th>수준</th>
                    <th>서비스</th>
                    <th>메시지</th>
                    <th className="numeric">상태</th>
                    <th className="numeric">처리 시간</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((event) => (
                    <tr key={event.event_id}>
                      <td className="mono">
                        {event.occurred_at.slice(11, 23).replace("Z", "")}
                      </td>
                      <td>
                        <Badge
                          tone={
                            event.level === "ERROR"
                              ? "orange"
                              : event.level === "WARN"
                                ? "purple"
                                : "green"
                          }
                        >
                          {event.level}
                        </Badge>
                      </td>
                      <td>
                        <span className="service-name">{event.service_id}</span>
                      </td>
                      <td className="log-message">
                        <span title={event.message}>{event.message}</span>
                        <small className="mono">{event.endpoint}</small>
                      </td>
                      <td className="numeric">
                        <span
                          className={
                            event.status_code >= 500 ? "warning-text" : ""
                          }
                        >
                          {event.status_code}
                        </span>
                      </td>
                      <td className="numeric mono">{event.duration_ms} ms</td>
                      <td>
                        <button
                          className="icon-button detail-button"
                          aria-label={`${event.service_id} ${event.occurred_at} 로그 상세`}
                          onClick={() => setSelected(event)}
                        >
                          <ArrowUpRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {number((data.page - 1) * data.limit + 1)}–
                {number((data.page - 1) * data.limit + data.items.length)} /{" "}
                {number(data.total)}건
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="이전 페이지"
                  disabled={page === 1}
                  onClick={() => setPage((v) => v - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {page} / {pages}
                </span>
                <button
                  className="icon-button"
                  aria-label="다음 페이지"
                  disabled={page >= pages || page * data.limit > 10000}
                  onClick={() => setPage((v) => v + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </Panel>
      <div className="source-note">
        <span>
          로그는 수집 직후 표시되며, 집계 지표는 Spark 작업 이후에 반영됩니다.
        </span>
      </div>
      <dialog
        ref={dialog}
        className="event-dialog"
        onCancel={() => setSelected(null)}
        onClose={() => setSelected(null)}
        aria-labelledby="event-title"
      >
        {selected && (
          <>
            <div className="dialog-header">
              <div>
                <p className="eyebrow">EVENT DETAIL</p>
                <h2 id="event-title">{selected.service_id} 로그 상세</h2>
              </div>
              <button
                className="icon-button"
                aria-label="로그 상세 닫기"
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="dialog-content">
              <div className="event-highlight">
                <Badge tone={selected.level === "ERROR" ? "orange" : "green"}>
                  {selected.level}
                </Badge>
                <strong>{selected.message}</strong>
              </div>
              <dl className="event-fields">
                {[
                  ["발생 시각", selected.occurred_at],
                  ["Endpoint", selected.endpoint],
                  ["HTTP 상태", selected.status_code],
                  ["처리 시간", `${selected.duration_ms} ms`],
                  ["Trace ID", selected.trace_id],
                  ["Event ID", selected.event_id],
                  ["환경", selected.environment],
                  ["User ID", selected.user_id],
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd className="mono">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="json-heading">
                <h3>원본 이벤트</h3>
                <button
                  className="button secondary small"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        JSON.stringify(selected, null, 2),
                      );
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}{" "}
                  {copied ? "복사됨" : "JSON 복사"}
                </button>
              </div>
              <pre>{JSON.stringify(selected, null, 2)}</pre>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
