"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  LayoutDashboard,
  ScrollText,
  Network,
  Sparkles,
  RefreshCw,
  Database,
  ArrowUpRight,
  Box,
} from "lucide-react";
import { useWorkspace } from "./workspace";
import type { ReactNode } from "react";
const items = [
  { href: "/", label: "전체 현황", icon: LayoutDashboard },
  { href: "/logs", label: "로그 탐색", icon: ScrollText },
  { href: "/topology", label: "서비스 관계", icon: Network },
  { href: "/assistant", label: "분석 도우미", icon: Sparkles },
];
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const ws = useWorkspace();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Box size={25} strokeWidth={1.6} />
          </span>
          <span>
            lakehouse<span className="brand-sub">OPERATIONS LAB</span>
          </span>
        </Link>
        <div className="workspace-switch">
          <span className="workspace-avatar">O</span>
          <div>
            <strong>Operations workspace</strong>
            <small>학습용 로컬 환경</small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="주 메뉴">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              href={href}
              key={href}
              className={`nav-item ${path === href ? "active" : ""}`}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {path === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="lab-note">
            <Database size={19} />
            <strong>로그 한 줄에서 인사이트까지</strong>
            <p>
              모의 서비스 데이터를 탐색하며
              <br />
              분석 흐름을 익혀보세요.
            </p>
            <Link href="/assistant">
              근거 조회 시작하기 <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="local-state">
            <span
              className={`status-dot ${ws.status?.core && ws.status?.agent ? "online" : ""}`}
            />
            <span>
              {!ws.status
                ? "서비스 상태 확인 중"
                : ws.status.core && ws.status.agent
                  ? "Core · Agent 연결됨"
                  : "서비스 연결 확인 필요"}
            </span>
          </div>
          <span className="version">LOCAL WORKSPACE · v0.1</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Activity size={17} />
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{items.find((i) => i.href === path)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="sample-pill">모의 데이터</span>
            <span className="header-divider" />
            <span className="user-avatar">JL</span>
          </div>
        </header>
        <div className="filterbar">
          <div className="filter-label">
            <span
              className={`status-dot ${ws.status?.core && ws.status?.agent ? "online" : ""}`}
            />
            서비스 관측 <span className="utc-label">UTC 기준</span>
          </div>
          <div className="global-filters">
            <label className="sr-only" htmlFor="global-day">
              조회 날짜
            </label>
            <input
              id="global-day"
              aria-label="조회 날짜"
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              value={ws.day}
              onChange={(e) => {
                if (e.target.value && e.target.validity.valid)
                  ws.setDay(e.target.value);
              }}
              onBlur={(e) => {
                // Some native date editors commit segmented input only on blur.
                if (e.currentTarget.value && e.currentTarget.validity.valid) {
                  ws.setDay(e.currentTarget.value);
                } else {
                  e.currentTarget.value = ws.day;
                }
              }}
            />
            <label className="sr-only" htmlFor="global-env">
              환경
            </label>
            <select
              id="global-env"
              value={ws.environment}
              onChange={(e) => ws.setEnvironment(e.target.value)}
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
            </select>
            <button
              className="icon-button"
              aria-label="데이터 새로고침"
              title="저장된 데이터를 다시 조회합니다"
              onClick={ws.reload}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        <main>{children}</main>
        <footer className="page-footer">
          <span>Operations Log Lakehouse Lab</span>
          <span>모든 시간은 UTC로 표시됩니다.</span>
        </footer>
      </div>
    </div>
  );
}
