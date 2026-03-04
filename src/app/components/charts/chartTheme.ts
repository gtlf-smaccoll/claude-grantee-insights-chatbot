// Shared chart theme constants for dark dashboard
// Designed for bg-gray-950 background with GitLab brand colors

export const CHART_COLORS = {
  // Axes, gridlines, tick labels
  axis: "#6b7280", // gray-500
  grid: "#1f2937", // gray-800
  tickLabel: "#9ca3af", // gray-400

  // Tooltip
  tooltipBg: "#111827", // gray-900
  tooltipBorder: "#374151", // gray-700
  tooltipText: "#f3f4f6", // gray-100

  // Chart accent (primary)
  primary: "#F96D26", // gitlab-orange
  primaryLight: "#F9A026", // gitlab-gold

  // Line chart
  line: "#F96D26",
  lineArea: "rgba(249, 109, 38, 0.15)",

  // Bar chart
  bar: "#F96D26",
  barHover: "#F9A026",
};

// Categorical palette for scatter/donut (high contrast on dark bg)
export const CATEGORICAL_COLORS = [
  "#F96D26", // gitlab-orange
  "#22d3ee", // cyan-400
  "#F9A026", // gitlab-gold
  "#a78bfa", // violet-400
  "#34d399", // emerald-400
  "#f472b6", // pink-400
  "#60a5fa", // blue-400
  "#fbbf24", // amber-400
  "#6b4fbb", // gitlab-purple
  "#fb923c", // orange-400
];

// Shared Recharts tooltip style
export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: CHART_COLORS.tooltipBg,
    border: `1px solid ${CHART_COLORS.tooltipBorder}`,
    borderRadius: "8px",
    fontSize: "12px",
    color: CHART_COLORS.tooltipText,
    padding: "8px 12px",
  },
  itemStyle: { color: CHART_COLORS.tooltipText },
  labelStyle: { color: CHART_COLORS.tickLabel, marginBottom: 4 },
};

// Format large dollar amounts compactly
export function formatCompactMoney(value: number): string {
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

// Format large numbers compactly
export function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return value.toLocaleString();
}

// Compute median from an array of numbers
export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
