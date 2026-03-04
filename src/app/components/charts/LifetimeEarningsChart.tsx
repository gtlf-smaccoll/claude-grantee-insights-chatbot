"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { CondensedGrant } from "@/types/grants";
import {
  CHART_COLORS,
  TOOLTIP_STYLE,
  formatCompactMoney,
} from "./chartTheme";

interface LifetimeEarningsChartProps {
  grants: CondensedGrant[];
}

export default function LifetimeEarningsChart({
  grants,
}: LifetimeEarningsChartProps) {
  const { data, grantCount } = useMemo(() => {
    const byCountry: Record<string, number> = {};
    let count = 0;
    for (const g of grants) {
      if (g.pv_lifetime_income_gain != null && g.pv_lifetime_income_gain > 0) {
        const country = g.country || "Unknown";
        byCountry[country] = (byCountry[country] || 0) + g.pv_lifetime_income_gain;
        count++;
      }
    }
    const sorted = Object.entries(byCountry)
      .map(([country, total]) => ({ country, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    return { data: sorted, grantCount: count };
  }, [grants]);

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h4 className="text-xs font-semibold text-gray-400 mb-1">
          Estimated Lifetime Earnings by Country
        </h4>
        <p className="text-xs text-gray-600">No earnings data available</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-400">
          Estimated Lifetime Earnings by Country
        </h4>
        <span className="text-[10px] text-gray-600">
          {grantCount} grants with data
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
        >
          <XAxis
            type="number"
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.tickLabel, fontSize: 10 }}
            tickFormatter={(v: number) => formatCompactMoney(v)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="country"
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.tickLabel, fontSize: 11 }}
            width={90}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value) => [formatCompactMoney(Number(value)), "Lifetime Earnings"]}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {data.map((_, index) => (
              <Cell
                key={index}
                fill={index === 0 ? CHART_COLORS.primary : CHART_COLORS.primaryLight}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
