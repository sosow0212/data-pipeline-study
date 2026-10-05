import assert from "node:assert/strict";
import { test } from "node:test";
import {
  summarize,
  timeline,
  type HourlyMetric,
} from "../src/features/observability/domain/metrics.ts";
const metric = (
  requests: number,
  average: number,
  hour: string,
): HourlyMetric => ({
  service_id: "checkout",
  environment: "production",
  hour,
  requests,
  errors: 1,
  error_rate: 1 / requests,
  avg_duration_ms: average,
  p95_duration_ms: average * 2,
});
test("weighted mean and error rate use requests; peak p95 is never averaged", () => {
  const stats = summarize([
    metric(10, 1000, "2026-10-01T12:00:00"),
    metric(90, 100, "2026-10-01T13:00:00"),
  ]);
  assert.equal(stats.average, 190);
  assert.equal(stats.errorRate, 0.02);
  assert.equal(stats.peakHourlyP95, 2000);
});
test("UTC hour bucketing fills gaps and flags missing observations", () => {
  const rows = timeline([metric(10, 1000, "2026-10-01T12:00:00")]);
  assert.equal(rows.length, 24);
  assert.equal(rows[12].requests, 10);
  assert.equal(rows[0].present, false);
  assert.equal(summarize([]).average, 0);
  assert.equal(summarize([]).errorRate, 0);
});
