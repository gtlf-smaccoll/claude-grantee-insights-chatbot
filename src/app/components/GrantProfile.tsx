"use client";

import { GrantRecord } from "@/types/grants";

interface GrantProfileProps {
  grant: GrantRecord | null;
  onClose: () => void;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex justify-between items-start gap-4 py-2">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className="text-sm text-gray-200 text-right">{value || "—"}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4 border-b border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function GrantProfile({ grant, onClose }: GrantProfileProps) {
  if (!grant) return null;

  return (
    <div className="fixed right-0 top-0 w-96 h-screen bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-lg">
      {/* Sticky Header */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-gray-700 bg-gray-950 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-gray-100 truncate">
            {grant.grantee_name}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Ref: {grant.reference_number} • {grant.grantee_country}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-gray-400 hover:text-gray-300 text-xl leading-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {/* Overview Section */}
        <Section title="Overview">
          <div className="space-y-2">
            <Row label="Grant Title" value={grant.grant_title} />
            <Row label="Program Officer" value={grant.program_officer} />
            <Row label="Primary Intervention" value={grant.intervention_area_primary} />
            {grant.intervention_area_secondary && (
              <Row label="Secondary Intervention" value={grant.intervention_area_secondary} />
            )}
            <Row label="Impact Pathway" value={grant.impact_pathway} />
            <Row label="Labor Market Sector" value={grant.labor_market_sector} />
            <Row label="Project Mechanism" value={grant.project_mechanism} />
            <Row label="Population Focus" value={grant.primary_population_focus} />
          </div>
        </Section>

        {/* Financial Section */}
        <Section title="Financial">
          <div className="space-y-2">
            <Row label="Grant Amount" value={formatNumber(grant.grant_amount)} />
            <Row
              label="Total Investment (w/ overhead)"
              value={formatNumber(grant.total_investment_including_overhead)}
            />
            <Row
              label="Co-Investment"
              value={formatNumber(grant.additional_co_investment_amounts)}
            />
            <Row label="Cost Per Person" value={formatNumber(grant.cost_per_person)} />
          </div>
        </Section>

        {/* Timeline Section */}
        <Section title="Timeline">
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2">
              <span className="text-xs font-medium text-gray-500">Status</span>
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${
                  grant.active
                    ? "bg-green-900/30 text-green-300"
                    : "bg-gray-700/30 text-gray-300"
                }`}
              >
                {grant.active ? "Active" : "Completed"}
              </span>
            </div>
            <Row
              label="Approval Date"
              value={grant.grant_approval_date ? new Date(grant.grant_approval_date).toLocaleDateString() : undefined}
            />
            <Row
              label="Start Date"
              value={grant.grant_start_date ? new Date(grant.grant_start_date).toLocaleDateString() : undefined}
            />
            <Row
              label="Close Date"
              value={grant.grant_close_date ? new Date(grant.grant_close_date).toLocaleDateString() : undefined}
            />
            <Row label="Duration (Years)" value={grant.grant_years_length} />
            <Row label="Fiscal Year" value={grant.fiscal_year} />
          </div>
        </Section>

        {/* Impact Metrics Section */}
        <Section title="Impact Metrics">
          <div className="space-y-2">
            <Row
              label="People Served"
              value={grant.estimated_total_people_served?.toLocaleString()}
            />
            <Row
              label="ROI (Lifetime Income Gain)"
              value={grant.roi_lifetime_income_gain?.toFixed(1)}
            />
            <Row
              label="Income Change %"
              value={formatPercent(grant.pct_change_in_annual_income)}
            />
            <Row label="Living Wage Threshold" value={grant.living_wage_threshold} />
            <Row
              label="Post-Intervention Income (Avg)"
              value={formatNumber(grant.post_intervention_income_avg)}
            />
            <Row
              label="Evidence Quality"
              value={grant.evidence_quality_assessment}
            />
            <Row label="Execution Risk" value={grant.execution_risk} />
          </div>
        </Section>

        {/* Demographics Section */}
        <Section title="Demographics">
          <div className="space-y-2">
            <Row label="Leadership Gender" value={grant.leadership_gender} />
            <Row label="Leadership Ethnicity" value={grant.leadership_ethnicity} />
            <Row
              label="Women Impacted %"
              value={formatPercent(grant.women_impacted_percent)}
            />
            <Row
              label="Historically Marginalized %"
              value={formatPercent(grant.historically_marginalized_percent)}
            />
            <Row label="Immigrants/Refugees %" value={grant.immigrants_or_refugees} />
            <Row label="Justice Involved %" value={grant.justice_involved} />
            <Row label="LGBTQ+ %" value={grant.lgbtq} />
          </div>
        </Section>

        {/* Classification Section */}
        <Section title="Classification">
          <div className="space-y-2">
            <Row label="RFP Cohort" value={grant.rfp} />
            <Row label="Portfolio Type" value={grant.grant_portfolio_type} />
            <Row label="Strategic Alignment" value={grant.strategic_alignment} />
          </div>
        </Section>

        {/* Document Availability */}
        <Section title="Documents">
          <p className="text-xs text-gray-500">
            Document search coming in Phase 3b
          </p>
        </Section>
      </div>
    </div>
  );
}
