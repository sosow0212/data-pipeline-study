export interface LogEvent {
  event_id: string;
  occurred_at: string;
  service_id: string;
  environment: string;
  level: "INFO" | "WARN" | "ERROR";
  endpoint: string;
  status_code: number;
  duration_ms: number;
  trace_id: string;
  user_id: string;
  message: string;
}
export interface EventPage {
  items: LogEvent[];
  total: number;
  page: number;
  limit: number;
}
