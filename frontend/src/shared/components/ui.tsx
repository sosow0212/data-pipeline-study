"use client";
import { AlertCircle, ArrowUpRight, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function LoadState({
  error,
  loading,
  empty,
  onRetry,
}: {
  error?: Error;
  loading?: boolean;
  empty?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className={`load-state ${error ? "has-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {error ? (
        <AlertCircle size={24} />
      ) : loading ? (
        <LoaderCircle size={24} className="spin" />
      ) : (
        <ArrowUpRight size={24} />
      )}
      <strong>
        {error
          ? "데이터를 불러오지 못했습니다"
          : loading
            ? "데이터를 불러오는 중입니다"
            : "조회 결과가 없습니다"}
      </strong>
      <p>{error ? error.message : empty || "잠시만 기다려 주세요."}</p>
      {error && onRetry && (
        <button className="button secondary" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "orange" | "purple";
}) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
