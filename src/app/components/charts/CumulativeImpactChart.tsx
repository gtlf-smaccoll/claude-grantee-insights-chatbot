"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { CondensedGrant } from "@/types/grants";
import {
  CHART_COLORS,
  TOOLTIP_STYLE,
  formatCompactNumber,
} from "./chartTheme";

interface CumulativeImpactChartProps {
  grants: CondensedGrant[];
}

interface MonthlyDataPoint {
  month: string;
  cumulative: number;
  added: number;
}

function parseDate(dateStr: string): Date | null {
  // Handle various date formats from Google Sheets
  // Common formats: "2024-01-15", "1/15/2024", "01/15/2024", "January 15, 2024"
  const d = new Date(dateStr);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;
  return null;
}

export default function CumulativeImpactChart({
  grants,
}: CumulativeImpactChartProps) {
  const { data, grantCount, total } = useMemo(() => {
    // Gather grants with both a valid start date and people_served
    const entries = grants
      .filter((g) => g.start_date && g.people_served != null && g.people_served > 0)
      .map((g) => ({
        date: parseDate(g.start_date!),
        people: g.people_served!,
      }))
      .filter((e): e is { date: Date; people: number } => e.date !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (entries.length === 0) return { data: [], grantCount: 0, total: 0 };

    // Group by month and compute cumulative
    const monthlyMap = new Map<string, number>();
    for (const e of entries) {
      const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + e.people);
    }

    // Build cumulative series
    let cumulative = 0;
    const points: MonthlyDataPoint[] = [];
    const sortedMonths = Array.from(monthlyMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    for (const [month, added] of sortedMonths) {
      cumulative += added;
      points.push({ month, cumulative, added });
    }

    return { data: points, grantCount: entries.length, total: cumulative };
  }, [grants]);

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h4 className="text-xs font-semibold text-gray-400 mb-1">
          Cumulative People Impacted
        </h4>
        <p className="text-xs text-gray-600">No impact data available</p>
      </div>
    );
  }

  // Format month labels: "2024-01" → "Jan 24"
  const formatMonth = (month: string) => {
    const [year, m] = month.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(m, 10) - 1]} ${year.slice(2)}`;
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-400">
          Cumulative People Impacted
        </h4>
        <span className="text-[10px] text-gray-600">
          {formatCompactNumber(total)} total · {grantCount} grants
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 10, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="impactGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.grid}
            vertical={false}
          />
          <XAxis
            dataKey="month"
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.tickLabel, fontSize: 10 }}
            tickFormatter={formatMonth}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.tickLabel, fontSize: 10 }}
            tickFormatter={(v: number) => formatCompactNumber(v)}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            labelFormatter={(label) => formatMonth(String(label))}
            formatter={(value, name) => {
              if (name === "cumulative")
                return [formatCompactNumber(Number(value)), "Total People"];
              return [formatCompactNumber(Number(value)), "Added This Month"];
            }}
          />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            fill="url(#impactGradient)"
            dot={false}
            activeDot={{
              r: 4,
              fill: CHART_COLORS.primary,
              stroke: CHART_COLORS.tooltipBg,
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
