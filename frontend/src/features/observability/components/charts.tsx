"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { timeline, type HourlyMetric } from "../domain/metrics";
const axis = { fontSize: 11, fill: "#929da9" };
export function TrafficChart({ rows }: { rows: HourlyMetric[] }) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="시간별 요청 수와 오류 수 그래프"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={timeline(rows)}
          margin={{ top: 16, right: 6, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#178c7d" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#178c7d" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#edf0f2" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={axis}
            tickLine={false}
            axisLine={false}
            interval={3}
            tickMargin={13}
          />
          <YAxis
            tick={axis}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              borderColor: "#e6eaed",
              fontSize: 12,
            }}
            labelFormatter={(v) => `${v} UTC`}
          />
          <Area
            name="요청"
            type="monotone"
            dataKey="requests"
            stroke="#168a7a"
            strokeWidth={2.5}
            fill="url(#trafficFill)"
          />
          <Area
            name="오류"
            type="monotone"
            dataKey="errors"
            stroke="#e89b56"
            strokeWidth={2}
            fill="transparent"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function LatencyChart({ rows }: { rows: HourlyMetric[] }) {
  const data = timeline(rows).map((row) => ({
    ...row,
    average: row.present ? row.average : null,
    peakHourlyP95: row.present ? row.peakHourlyP95 : null,
  }));
  return (
    <div
      className="chart small"
      role="img"
      aria-label="선택한 서비스의 시간별 p95와 평균 지연 그래프"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 16, right: 6, left: -16, bottom: 0 }}
        >
          <CartesianGrid stroke="#edf0f2" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={axis}
            tickLine={false}
            axisLine={false}
            interval={5}
            tickMargin={13}
          />
          <YAxis tick={axis} tickLine={false} axisLine={false} unit="" />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              borderColor: "#e6eaed",
              fontSize: 12,
            }}
            labelFormatter={(v) => `${v} UTC`}
          />
          <Line
            name="p95 (ms)"
            type="monotone"
            dataKey="peakHourlyP95"
            stroke="#a496d0"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            name="평균 (ms)"
            type="monotone"
            dataKey="average"
            stroke="#bcc5cd"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
