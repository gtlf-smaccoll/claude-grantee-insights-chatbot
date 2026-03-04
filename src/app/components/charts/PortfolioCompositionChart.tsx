"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CondensedGrant } from "@/types/grants";
import {
  CATEGORICAL_COLORS,
  TOOLTIP_STYLE,
  formatCompactMoney,
} from "./chartTheme";

interface PortfolioCompositionChartProps {
  grants: CondensedGrant[];
}

interface PieDataItem {
  name: string;
  value: number;
  amount: number;
}

export default function PortfolioCompositionChart({
  grants,
}: PortfolioCompositionChartProps) {
  const alignmentData = useMemo<PieDataItem[]>(() => {
    const counts: Record<string, { count: number; amount: number }> = {};
    for (const g of grants) {
      const key = g.strategic_alignment || "Unclassified";
      if (!counts[key]) counts[key] = { count: 0, amount: 0 };
      counts[key].count++;
      counts[key].amount += g.amount ?? 0;
    }
    return Object.entries(counts)
      .map(([name, { count, amount }]) => ({ name, value: count, amount }))
      .sort((a, b) => b.value - a.value);
  }, [grants]);

  const portfolioTypeData = useMemo<PieDataItem[]>(() => {
    const counts: Record<string, { count: number; amount: number }> = {};
    for (const g of grants) {
      const key = g.portfolio_type || "Unclassified";
      if (!counts[key]) counts[key] = { count: 0, amount: 0 };
      counts[key].count++;
      counts[key].amount += g.amount ?? 0;
    }
    return Object.entries(counts)
      .map(([name, { count, amount }]) => ({ name, value: count, amount }))
      .sort((a, b) => b.value - a.value);
  }, [grants]);

  const totalInvested = useMemo(
    () => grants.reduce((sum, g) => sum + (g.amount ?? 0), 0),
    [grants]
  );

  const renderCenterLabel = () => (
    <text
      x="50%"
      y="50%"
      textAnchor="middle"
      dominantBaseline="middle"
      style={{ fill: "#d1d5db", fontSize: "10px", fontWeight: 500 }}
    >
      <tspan x="50%" dy="-6">
        {grants.length} grants
      </tspan>
      <tspan x="50%" dy="14" style={{ fill: "#6b7280", fontSize: "9px" }}>
        {formatCompactMoney(totalInvested)}
      </tspan>
    </text>
  );

  const renderLegend = (data: PieDataItem[]) => (
    <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
      {data.map((entry, index) => (
        <div key={entry.name} className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor:
                CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length],
            }}
          />
          <span className="text-[9px] text-gray-400 truncate max-w-[80px]">
            {entry.name}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-400">
          Portfolio Composition
        </h4>
        <span className="text-[10px] text-gray-600">
          {grants.length} grants
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {/* Strategic Alignment donut */}
        <div>
          <p className="text-[10px] text-gray-500 text-center mb-1">
            By Strategic Alignment
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={alignmentData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                dataKey="value"
                stroke="none"
                paddingAngle={2}
              >
                {alignmentData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={
                      CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length]
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value, name, props) => [
                  `${value} grants (${formatCompactMoney((props.payload as PieDataItem).amount)})`,
                  String(name),
                ]}
              />
              {renderCenterLabel()}
            </PieChart>
          </ResponsiveContainer>
          {renderLegend(alignmentData)}
        </div>

        {/* Portfolio Type donut */}
        <div>
          <p className="text-[10px] text-gray-500 text-center mb-1">
            By Portfolio Type
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={portfolioTypeData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                dataKey="value"
                stroke="none"
                paddingAngle={2}
              >
                {portfolioTypeData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={
                      CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length]
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value, name, props) => [
                  `${value} grants (${formatCompactMoney((props.payload as PieDataItem).amount)})`,
                  String(name),
                ]}
              />
              {renderCenterLabel()}
            </PieChart>
          </ResponsiveContainer>
          {renderLegend(portfolioTypeData)}
        </div>
      </div>
    </div>
  );
}
