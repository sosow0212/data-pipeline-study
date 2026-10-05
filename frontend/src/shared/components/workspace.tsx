"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import useSWR from "swr";
import { fetchJSON } from "@/shared/application/api";
import type { Service } from "@/features/observability/domain/metrics";

const Context = createContext<{
  day: string;
  setDay: (v: string) => void;
  environment: string;
  setEnvironment: (v: string) => void;
  refresh: number;
  reload: () => void;
  services: Service[];
  servicesError?: Error;
  servicesLoading: boolean;
  status?: { core: boolean; agent: boolean; model_configured: boolean };
} | null>(null);
export function Workspace({ children }: { children: ReactNode }) {
  const [day, setDay] = useState("2026-10-01");
  const [environment, setEnvironment] = useState("production");
  const [refresh, setRefresh] = useState(0);
  const { data, error, isLoading } = useSWR<Service[]>(
    ["/api/services", refresh],
    ([url]: [string, number]) => fetchJSON(url),
    { revalidateOnFocus: false },
  );
  const { data: status } = useSWR(
    ["/api/status", refresh],
    ([url]: [string, number]) =>
      fetchJSON<{ core: boolean; agent: boolean; model_configured: boolean }>(
        url,
      ),
    { revalidateOnFocus: false, refreshInterval: 30000 },
  );
  return (
    <Context.Provider
      value={{
        day,
        setDay,
        environment,
        setEnvironment,
        refresh,
        reload: () => setRefresh((v) => v + 1),
        services: data || [],
        servicesError: error,
        servicesLoading: isLoading,
        status,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Missing Workspace");
  return ctx;
}
