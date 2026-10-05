"use client";
import { useRef, useState } from "react";
import {
  Sparkles,
  ArrowUp,
  Database,
  ArrowRight,
  LoaderCircle,
  MessageSquare,
  Check,
} from "lucide-react";
import { useWorkspace } from "@/shared/components/workspace";
import { PageTitle, Badge, LoadState } from "@/shared/components/ui";
import { fetchJSON } from "@/shared/application/api";
import { EvidenceCard } from "./evidence-card";
import type { ChatResponse, Evidence } from "../domain/evidence";
interface Exchange {
  question: string;
  evidence: Evidence;
  answer?: string;
  usage?: Record<string, number>;
}
const suggestions = [
  "checkout의 지연이 증가한 이유를 조사해줘",
  "payment 오류가 다른 서비스에 영향을 줄 수 있어?",
  "gateway와 의존 서비스의 오류율을 비교해줘",
];
export function Assistant() {
  const ws = useWorkspace();
  const [service, setService] = useState("checkout");
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState("evidence");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [history, setHistory] = useState<Exchange[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true);
    setError(undefined);
    const submitted = question.trim();
    try {
      const body = JSON.stringify({
        service_id: service,
        day: ws.day,
        environment: ws.environment,
        question: submitted,
      });
      if (mode === "chat") {
        const result = await fetchJSON<ChatResponse>("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        setHistory((v) => [...v, { question: submitted, ...result }]);
      } else {
        const evidence = await fetchJSON<Evidence>("/api/evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        setHistory((v) => [...v, { question: submitted, evidence }]);
      }
      setQuestion("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error
          : new Error("분석 요청을 처리하지 못했습니다."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="ANALYSIS ASSISTANT"
        title="분석 도우미"
        description="서비스 지표와 관계, 운영 문서를 바탕으로 조사해 보세요."
        action={
          <Badge tone={ws.status?.model_configured ? "green" : "neutral"}>
            {ws.status?.model_configured
              ? "OpenAI 연결됨"
              : "근거 조회 사용 가능"}
          </Badge>
        }
      />
      <div className="assistant-layout">
        <section className="assistant-main">
          <div className="assistant-header">
            <span className="assistant-mark">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>Operations assistant</strong>
              <small>지표에 근거한 서비스 분석</small>
            </div>
            {history.length > 0 && (
              <button
                className="button secondary small"
                onClick={() => {
                  setHistory([]);
                  setError(undefined);
                }}
                disabled={busy}
              >
                대화 지우기
              </button>
            )}
          </div>
          <div className="conversation" aria-live="polite">
            {!history.length && (
              <div className="assistant-welcome">
                <div className="welcome-icon">
                  <Sparkles size={28} strokeWidth={1.5} />
                </div>
                <h2>어떤 서비스를 살펴볼까요?</h2>
                <p>
                  오류가 늘어난 시간대와 서비스 관계를 함께 확인하세요.
                  <br />
                  먼저 분석 근거를 조회하면 API 비용 없이 탐색할 수 있습니다.
                </p>
                <div className="suggestions">
                  {suggestions.map((q, i) => (
                    <button
                      key={q}
                      onClick={() => {
                        setQuestion(q);
                        setService(
                          i === 1
                            ? "payment"
                            : i === 2
                              ? "gateway"
                              : "checkout",
                        );
                        input.current?.focus();
                      }}
                    >
                      <MessageSquare size={14} />
                      <span>{q}</span>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {history.map((exchange, i) => (
              <div className="exchange" key={i}>
                <div className="user-message">
                  <span className="user-avatar">JL</span>
                  <p>{exchange.question}</p>
                </div>
                {exchange.answer && (
                  <div className="model-answer">
                    <span className="assistant-mark">
                      <Sparkles size={16} />
                    </span>
                    <div>
                      <strong>AI 분석 답변</strong>
                      <p>{exchange.answer}</p>
                      {exchange.usage && (
                        <small>
                          사용 토큰 · {JSON.stringify(exchange.usage)}
                        </small>
                      )}
                    </div>
                  </div>
                )}
                <EvidenceCard evidence={exchange.evidence} />
              </div>
            ))}
            {busy && (
              <div className="analysis-pending">
                <LoaderCircle className="spin" size={17} />
                지표와 서비스 관계를 조회하고 있습니다.
              </div>
            )}
            {error && <LoadState error={error} />}
          </div>
          <form className="composer" onSubmit={submit}>
            <div className="composer-options">
              <select
                aria-label="분석 대상 서비스"
                value={service}
                onChange={(e) => setService(e.target.value)}
              >
                {ws.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
              </select>
              <div className="mode-switch">
                <button
                  type="button"
                  className={mode === "evidence" ? "selected" : ""}
                  aria-pressed={mode === "evidence"}
                  onClick={() => setMode("evidence")}
                >
                  <Database size={12} />
                  근거 조회
                </button>
                <button
                  type="button"
                  className={mode === "chat" ? "selected" : ""}
                  aria-pressed={mode === "chat"}
                  disabled={!ws.status?.model_configured}
                  title={
                    ws.status?.model_configured
                      ? "OpenAI API를 호출합니다"
                      : "OpenAI API 키 연결 후 사용할 수 있습니다"
                  }
                  onClick={() => setMode("chat")}
                >
                  <Sparkles size={12} />
                  AI 답변
                </button>
              </div>
            </div>
            <div className="composer-input">
              <textarea
                ref={input}
                aria-label="분석 질문"
                maxLength={2000}
                rows={2}
                placeholder="서비스에 대해 궁금한 내용을 입력하세요..."
                value={question}
                disabled={busy}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <button
                className="send-button"
                type="submit"
                aria-label="분석 요청 보내기"
                disabled={
                  !question.trim() ||
                  busy ||
                  !ws.services.length ||
                  (mode === "chat" && !ws.status?.model_configured)
                }
              >
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <ArrowUp size={18} />
                )}
              </button>
            </div>
            <div className="composer-foot">
              <span>
                {mode === "evidence"
                  ? "근거 조회는 OpenAI를 호출하지 않습니다."
                  : "AI 답변은 OpenAI API 사용 비용이 발생합니다."}
              </span>
              <span>{question.length} / 2,000</span>
            </div>
          </form>
        </section>
        <aside className="assistant-context">
          <div className="context-card">
            <h3>이번 조사 범위</h3>
            <dl>
              <div>
                <dt>서비스</dt>
                <dd>{service}</dd>
              </div>
              <div>
                <dt>날짜</dt>
                <dd>{ws.day}</dd>
              </div>
              <div>
                <dt>환경</dt>
                <dd>{ws.environment}</dd>
              </div>
              <div>
                <dt>시간 기준</dt>
                <dd>UTC</dd>
              </div>
            </dl>
          </div>
          <div className="context-card">
            <h3>분석에 사용하는 데이터</h3>
            <div className="context-source">
              <span>
                <Database size={15} />
              </span>
              <div>
                <strong>시간별 서비스 지표</strong>
                <p>Trino · Iceberg Gold</p>
              </div>
            </div>
            <div className="context-source">
              <span>
                <Sparkles size={15} />
              </span>
              <div>
                <strong>관계와 운영 문서</strong>
                <p>Neo4j · Service / Runbook</p>
              </div>
            </div>
          </div>
          <div className="assistant-tips">
            <Check size={16} />
            <strong>근거부터 확인해 보세요.</strong>
            <p>
              질문마다 선택한 서비스와 날짜를 기준으로 독립적으로 분석합니다.
              이전 질문의 내용은 다음 요청에 전달되지 않습니다.
            </p>
            {!ws.status?.model_configured && (
              <p>OpenAI API 키를 연결하면 AI 답변을 사용할 수 있습니다.</p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
