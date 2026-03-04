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
} from "recharts";
import { CondensedGrant } from "@/types/grants";
import {
  CHART_COLORS,
  CATEGORICAL_COLORS,
  formatCompactMoney,
  formatCompactNumber,
} from "./chartTheme";

interface ROIScatterChartProps {
  grants: CondensedGrant[];
}

interface ScatterPoint {
  name: string;
  grantRef: string;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload as ScatterPoint | undefined;
  if (!data) return null;

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
      <p style={{ color: "#f3f4f6", fontWeight: 500, marginBottom: 4 }}>
        {data.name}
      </p>
      <p style={{ color: "#9ca3af", fontSize: 10, marginBottom: 8 }}>
        {data.grantRef} · {data.country}
      </p>
      <div style={{ color: "#d1d5db" }}>
        <p>
          North Star ROI:{" "}
          <span style={{ color: "#f3f4f6", fontWeight: 500 }}>
            {formatCompactNumber(data.x)}
          </span>
        </p>
        <p>
          Relative ROI DIL:{" "}
          <span style={{ color: "#f3f4f6", fontWeight: 500 }}>
            {formatCompactNumber(data.y)}
          </span>
        </p>
        <p>
          Grant Amount:{" "}
          <span style={{ color: "#f3f4f6", fontWeight: 500 }}>
            {formatCompactMoney(data.z)}
          </span>
        </p>
        <p style={{ color: "#6b7280", fontSize: 10, marginTop: 4 }}>
          {data.category}
        </p>
      </div>
    </div>
  );
}

export default function ROIScatterChart({ grants }: ROIScatterChartProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const { dataByCategory, categories, grantCount, xDomain, yDomain } = useMemo(() => {
    const points: ScatterPoint[] = grants
      .filter(
        (g) =>
          g.roi != null &&
          g.relative_roi_dil != null &&
          g.roi > 0 &&
          g.relative_roi_dil > 0
      )
      .map((g) => ({
        name: g.name,
        grantRef: g.ref,
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

    // Compute log-safe domain bounds
    const xValues = points.map((p) => p.x);
    const yValues = points.map((p) => p.y);
    const logFloor = (v: number) => Math.pow(10, Math.floor(Math.log10(v)));
    const logCeil = (v: number) => Math.pow(10, Math.ceil(Math.log10(v)));

    const xDomain: [number, number] =
      xValues.length > 0
        ? [logFloor(Math.min(...xValues)), logCeil(Math.max(...xValues))]
        : [1, 10000];
    const yDomain: [number, number] =
      yValues.length > 0
        ? [logFloor(Math.min(...yValues)), logCeil(Math.max(...yValues))]
        : [1, 10000];

    return {
      dataByCategory: groups,
      categories: cats,
      grantCount: points.length,
      xDomain,
      yDomain,
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
        <ScatterChart margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.grid}
          />
          <XAxis
            type="number"
            dataKey="x"
            name="North Star ROI"
            scale="log"
            domain={xDomain}
            allowDataOverflow
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.tickLabel, fontSize: 10 }}
            tickFormatter={(v: number) => formatCompactNumber(v)}
            axisLine={false}
            tickLine={false}
            label={{
              value: "North Star ROI ($)",
              position: "insideBottom",
              offset: -12,
              style: { fill: CHART_COLORS.tickLabel, fontSize: 10 },
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Relative ROI DIL"
            scale="log"
            domain={yDomain}
            allowDataOverflow
            reversed
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.tickLabel, fontSize: 10 }}
            tickFormatter={(v: number) => formatCompactNumber(v)}
            axisLine={false}
            tickLine={false}
            width={55}
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
          <Tooltip content={<CustomTooltip />} cursor={false} />
          {categories.map((cat, idx) => (
            <Scatter
              key={cat}
              name={cat}
              data={dataByCategory[cat]}
              fill={CATEGORICAL_COLORS[idx % CATEGORICAL_COLORS.length]}
              fillOpacity={
                hoveredCategory === null || hoveredCategory === cat
                  ? 0.75
                  : 0.15
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
