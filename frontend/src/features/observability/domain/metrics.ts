export interface HourlyMetric {
  service_id: string;
  environment: string;
  hour: string;
  requests: number;
  errors: number;
  error_rate: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
}
export interface MetricsResponse {
  day: string;
  environment: string;
  hourly_metrics: HourlyMetric[];
  aggregated_at: string | null;
  truncated: boolean;
  source: string;
}
export interface Service {
  id: string;
  name: string;
  team: string;
  dependencies: string[];
}
export function summarize(rows: HourlyMetric[]) {
  const requests = rows.reduce((sum, row) => sum + row.requests, 0);
  const errors = rows.reduce((sum, row) => sum + row.errors, 0);
  return {
    requests,
    errors,
    errorRate: requests ? errors / requests : 0,
    average: requests
      ? rows.reduce((sum, row) => sum + row.avg_duration_ms * row.requests, 0) /
        requests
      : 0,
    peakHourlyP95: rows.length
      ? Math.max(...rows.map((row) => row.p95_duration_ms))
      : 0,
  };
}
export function timeline(rows: HourlyMetric[]) {
  return Array.from({ length: 24 }, (_, hour) => {
    // Trino's timestamp has no offset; the pipeline explicitly stores UTC hours.
    const values = rows.filter(
      (row) => Number(row.hour.slice(11, 13)) === hour,
    );
    return {
      hour: `${String(hour).padStart(2, "0")}:00`,
      ...summarize(values),
      present: values.length > 0,
    };
  });
}
export const number = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);
export const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
export const milliseconds = (value: number) => `${Math.round(value)} ms`;
