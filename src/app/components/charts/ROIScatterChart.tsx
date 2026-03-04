"use client";

import { useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { CondensedGrant } from "@/types/grants";
import {
  CHART_COLORS,
  CATEGORICAL_COLORS,
  TOOLTIP_STYLE,
  formatCompactMoney,
} from "./chartTheme";

interface ROIScatterChartProps {
  grants: CondensedGrant[];
}

interface ScatterPoint {
  name: string;
  ref: string;
  x: number;
  y: number;
  z: number;
  category: string;
  country: string;
  model: string;
}

// Custom tooltip for the scatter chart
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ScatterPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;

  return (
    <div
      style={{
        backgroundColor: CHART_COLORS.tooltipBg,
        border: `1px solid ${CHART_COLORS.tooltipBorder}`,
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "11px",
      }}
    >
      <p className="text-gray-100 font-medium mb-1">{data.name}</p>
      <p className="text-gray-400 text-[10px] mb-2">
        {data.ref} · {data.country}
      </p>
      <div className="space-y-0.5 text-gray-300">
        <p>
          North Star ROI: <span className="text-gray-100 font-medium">{data.x.toLocaleString()}</span>
        </p>
        <p>
          Relative ROI DIL: <span className="text-gray-100 font-medium">{data.y.toLocaleString()}</span>
        </p>
        <p>
          Grant Amount: <span className="text-gray-100 font-medium">{formatCompactMoney(data.z)}</span>
        </p>
        <p className="text-[10px] text-gray-500">{data.category}</p>
      </div>
    </div>
  );
}

export default function ROIScatterChart({ grants }: ROIScatterChartProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const { dataByCategory, categories, grantCount } = useMemo(() => {
    const points: ScatterPoint[] = grants
      .filter((g) => g.roi != null && g.relative_roi_dil != null && g.roi > 0 && g.relative_roi_dil > 0)
      .map((g) => ({
        name: g.name,
        ref: g.ref,
        x: g.roi!,
        y: g.relative_roi_dil!,
        z: g.amount ?? 50000,
        category: g.strategic_alignment || "Unclassified",
        country: g.country,
        model: g.roi_or_dil_project,
      }));

    // Group by category
    const groups: Record<string, ScatterPoint[]> = {};
    for (const p of points) {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }

    const cats = Object.keys(groups).sort(
      (a, b) => groups[b].length - groups[a].length
    );

    return {
      dataByCategory: groups,
      categories: cats,
      grantCount: points.length,
    };
  }, [grants]);

  if (grantCount === 0) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h4 className="text-xs font-semibold text-gray-400 mb-1">
          ROI Performance by Strategic Alignment
        </h4>
        <p className="text-xs text-gray-600">
          No grants with both ROI and DIL data
        </p>
      </div>
    );
  }

  // Bubble size range
  const sizeRange: [number, number] = [40, 400];

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-xs font-semibold text-gray-400">
          ROI Performance by Strategic Alignment
        </h4>
        <span className="text-[10px] text-gray-600">
          {grantCount} grants with data
        </span>
      </div>
      <p className="text-[10px] text-gray-600 mb-3">
        X: North Star ROI (per $1) · Y: Relative ROI DIL · Size: Grant Amount
      </p>

      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.grid}
          />
          <XAxis
            type="number"
            dataKey="x"
            name="North Star ROI"
            scale="log"
            domain={["auto", "auto"]}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.tickLabel, fontSize: 10 }}
            tickFormatter={(v: number) => v.toLocaleString()}
            axisLine={false}
            tickLine={false}
            label={{
              value: "North Star ROI ($)",
              position: "insideBottom",
              offset: -2,
              style: { fill: CHART_COLORS.tickLabel, fontSize: 10 },
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Relative ROI DIL"
            scale="log"
            domain={["auto", "auto"]}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.tickLabel, fontSize: 10 }}
            tickFormatter={(v: number) => v.toLocaleString()}
            axisLine={false}
            tickLine={false}
            width={50}
            label={{
              value: "Relative ROI DIL",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              style: { fill: CHART_COLORS.tickLabel, fontSize: 10 },
            }}
          />
          <ZAxis
            type="number"
            dataKey="z"
            range={sizeRange}
            name="Grant Amount"
          />
          {/* Reference lines for thresholds */}
          <ReferenceLine
            x={100}
            stroke={CHART_COLORS.axis}
            strokeDasharray="5 5"
            strokeOpacity={0.5}
          />
          <ReferenceLine
            y={1000}
            stroke={CHART_COLORS.axis}
            strokeDasharray="5 5"
            strokeOpacity={0.5}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={false}
          />
          {categories.map((cat, idx) => (
            <Scatter
              key={cat}
              name={cat}
              data={dataByCategory[cat]}
              fill={CATEGORICAL_COLORS[idx % CATEGORICAL_COLORS.length]}
              fillOpacity={
                hoveredCategory === null || hoveredCategory === cat ? 0.75 : 0.15
              }
              strokeWidth={0}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
        {categories.map((cat, idx) => (
          <button
            key={cat}
            className="flex items-center gap-1 cursor-pointer"
            onMouseEnter={() => setHoveredCategory(cat)}
            onMouseLeave={() => setHoveredCategory(null)}
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor:
                  CATEGORICAL_COLORS[idx % CATEGORICAL_COLORS.length],
                opacity:
                  hoveredCategory === null || hoveredCategory === cat
                    ? 1
                    : 0.3,
              }}
            />
            <span
              className={`text-[9px] transition-colors ${
                hoveredCategory === null || hoveredCategory === cat
                  ? "text-gray-400"
                  : "text-gray-600"
              }`}
            >
              {cat} ({dataByCategory[cat].length})
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
