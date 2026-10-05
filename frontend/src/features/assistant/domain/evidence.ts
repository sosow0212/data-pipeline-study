import type { HourlyMetric } from "@/features/observability/domain/metrics";
export interface Evidence {
  service_id: string;
  day: string;
  environment: string;
  topology: {
    name: string;
    team: string;
    dependencies: string[];
    potentially_affected: string[];
  };
  hourly_metrics: HourlyMetric[];
  runbooks: { id: string; title: string; content: string; retrieval: string }[];
  limitations: string[];
  sources: string[];
}
export interface ChatResponse {
  answer: string;
  evidence: Evidence;
  usage: Record<string, number>;
}
