"use client";

import { useMemo } from "react";
import { CondensedGrant } from "@/types/grants";
import {
  formatCompactMoney,
  formatCompactNumber,
  computeMedian,
} from "./chartTheme";

interface ROISummaryTableProps {
  grants: CondensedGrant[];
}

interface ModelStats {
  label: string;
  count: number;
  pctOfPortfolio: number;
  medianValue: number | null;
  valueLabel: string;
  medianCostPerPerson: number | null;
  totalPeopleServed: number;
  medianIncomeChangePct: number | null;
}

export default function ROISummaryTable({ grants }: ROISummaryTableProps) {
  const stats = useMemo(() => {
    const roiGrants = grants.filter(
      (g) =>
        g.roi_or_dil_project &&
        g.roi_or_dil_project.toLowerCase().includes("roi")
    );
    const dilGrants = grants.filter(
      (g) =>
        g.roi_or_dil_project &&
        g.roi_or_dil_project.toLowerCase().includes("dil")
    );

    const total = grants.length;

    const buildStats = (
      subset: CondensedGrant[],
      label: string,
      valueField: "roi" | "relative_roi_dil",
      valueLabel: string
    ): ModelStats => ({
      label,
      count: subset.length,
      pctOfPortfolio: total > 0 ? Math.round((subset.length / total) * 100) : 0,
      medianValue: computeMedian(
        subset.filter((g) => g[valueField] != null).map((g) => g[valueField]!)
      ),
      valueLabel,
      medianCostPerPerson: computeMedian(
        subset
          .filter((g) => g.cost_per_person != null)
          .map((g) => g.cost_per_person!)
      ),
      totalPeopleServed: subset.reduce(
        (sum, g) => sum + (g.people_served ?? 0),
        0
      ),
      medianIncomeChangePct: computeMedian(
        subset
          .filter((g) => g.income_change_pct != null)
          .map((g) => g.income_change_pct!)
      ),
    });

    return {
      roi: buildStats(roiGrants, "North Star ROI Model", "roi", "ROI (per $1 invested)"),
      dil: buildStats(dilGrants, "Double Income (DIL) Model", "relative_roi_dil", "Cost to Double Income"),
    };
  }, [grants]);

  const formatValue = (value: number | null, prefix = "") => {
    if (value == null) return "—";
    return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const rows: { label: string; roi: string; dil: string }[] = [
    {
      label: "Grants Using Model",
      roi: `${stats.roi.count} | ${stats.roi.pctOfPortfolio}%`,
      dil: `${stats.dil.count} | ${stats.dil.pctOfPortfolio}%`,
    },
    {
      label: "Median Value",
      roi: formatValue(stats.roi.medianValue),
      dil: stats.dil.medianValue != null
        ? formatCompactMoney(stats.dil.medianValue)
        : "—",
    },
    {
      label: "Median Cost / Person",
      roi:
        stats.roi.medianCostPerPerson != null
          ? formatCompactMoney(stats.roi.medianCostPerPerson)
          : "—",
      dil:
        stats.dil.medianCostPerPerson != null
          ? formatCompactMoney(stats.dil.medianCostPerPerson)
          : "—",
    },
    {
      label: "Total People Served",
      roi: formatCompactNumber(stats.roi.totalPeopleServed),
      dil: formatCompactNumber(stats.dil.totalPeopleServed),
    },
    {
      label: "Median Income Change",
      roi:
        stats.roi.medianIncomeChangePct != null
          ? `${stats.roi.medianIncomeChangePct.toFixed(0)}%`
          : "—",
      dil:
        stats.dil.medianIncomeChangePct != null
          ? `${stats.dil.medianIncomeChangePct.toFixed(0)}%`
          : "—",
    },
  ];

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-semibold text-gray-400">
          ROI Impact Estimation
        </h4>
        <span className="text-[10px] text-gray-600">
          {stats.roi.count + stats.dil.count} grants with model data
        </span>
      </div>

      {/* Description */}
      <p className="text-[10px] text-gray-500 mb-4">
        Two cost-effectiveness models evaluate grant impact: the{" "}
        <span className="text-gray-300 font-medium">North Star ROI</span>{" "}
        estimates lifetime earnings increase per $1 invested, while the{" "}
        <span className="text-gray-300 font-medium">DIL model</span>{" "}
        calculates the cost to effectively double a participant&apos;s lifetime income.
      </p>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 pr-4 text-gray-500 font-medium w-1/3">
                Metric
              </th>
              <th className="text-center py-2 px-2 text-gray-300 font-semibold w-1/3">
                {stats.roi.valueLabel}
              </th>
              <th className="text-center py-2 pl-2 text-gray-300 font-semibold w-1/3">
                {stats.dil.valueLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-gray-800">
                <td className="py-2.5 pr-4 text-gray-400">{row.label}</td>
                <td className="py-2.5 px-2 text-center text-gray-200 font-medium">
                  {row.roi}
                </td>
                <td className="py-2.5 pl-2 text-center text-gray-200 font-medium">
                  {row.dil}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
