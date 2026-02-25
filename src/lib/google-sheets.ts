import { google } from "googleapis";
import {
  GrantRecord,
  CondensedGrant,
  GrantRegistry,
  PortfolioSummary,
} from "@/types/grants";
import { getGoogleAuthClient } from "./google-auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cachedRegistry: GrantRegistry | null = null;
let cacheTimestamp = 0;

function getAuthClient() {
  return getGoogleAuthClient([
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ]);
}

// Map spreadsheet column headers to our GrantRecord field names.
// This handles the messy reality of spreadsheet headers with varying
// capitalization, spaces, and naming conventions.
const HEADER_MAP: Record<string, keyof GrantRecord> = {
  grantee_id: "grantee_id",
  "grantee id": "grantee_id",
  "reference number": "reference_number",
  reference_number: "reference_number",
  "grantee name": "grantee_name",
  grantee_name: "grantee_name",
  "grant title": "grant_title",
  grant_title: "grant_title",
  "grantee country": "grantee_country",
  grantee_country: "grantee_country",
  state: "state",
  "program officer": "program_officer",
  program_officer: "program_officer",
  rfp: "rfp",
  "grant portfolio type": "grant_portfolio_type",
  grant_portfolio_type: "grant_portfolio_type",
  "intervention area primary": "intervention_area_primary",
  intervention_area_primary: "intervention_area_primary",
  "intervention area secondary": "intervention_area_secondary",
  intervention_area_secondary: "intervention_area_secondary",
  "impact pathway": "impact_pathway",
  impact_pathway: "impact_pathway",
  "labor market sector": "labor_market_sector",
  labor_market_sector: "labor_market_sector",
  "project mechanism": "project_mechanism",
  project_mechanism: "project_mechanism",
  "primary population focus": "primary_population_focus",
  primary_population_focus: "primary_population_focus",
  "strategic alignment": "strategic_alignment",
  strategic_alignment: "strategic_alignment",
  "grant amount": "grant_amount",
  grant_amount: "grant_amount",
  "total investment including overhead": "total_investment_including_overhead",
  "total grant amount committed": "total_grant_amount_committed",
  "additional co-investment amounts": "additional_co_investment_amounts",
  "cost per person": "cost_per_person",
  cost_per_person: "cost_per_person",
  "grant approval date": "grant_approval_date",
  "grant start date": "grant_start_date",
  "grant close date": "grant_close_date",
  "grant years length": "grant_years_length",
  "fiscal year": "fiscal_year",
  fiscal_year: "fiscal_year",
  quarter: "quarter",
  "fiscal year and quarter": "fiscal_year_and_quarter",
  active: "active",
  "estimated total people served": "estimated_total_people_served",
  "original estimate total people served":
    "original_estimate_total_people_served",
  "pct earning below living wage": "pct_earning_below_living_wage",
  "estimated people impacted below a living wage":
    "estimated_people_impacted_below_living_wage",
  "pct earning above living wage due to intervention":
    "pct_earning_above_living_wage_due_to_intervention",
  "estimated people earning above living wage due to intervention":
    "estimated_people_earning_above_living_wage",
  "living wage threshold": "living_wage_threshold",
  "comparison income avg": "comparison_income_avg",
  "post-intervention income avg": "post_intervention_income_avg",
  "intervention income change avg": "intervention_income_change_avg",
  "pct change in annual income": "pct_change_in_annual_income",
  "undiscounted aggregate lifetime income":
    "undiscounted_aggregate_lifetime_income",
  "present value of aggregate lifetime income gain estimate":
    "present_value_lifetime_income_gain",
  "roi lifetime income gain": "roi_lifetime_income_gain",
  "relative roi dil": "relative_roi_dil",
  "lifetime earnings increase per person":
    "lifetime_earnings_increase_per_person",
  "undiscounted lifetime earnings increase per person":
    "undiscounted_lifetime_earnings_increase_per_person",
  "number double income for life equivalent": "number_dil_equivalent",
  "number dil people per dollar": "number_dil_people_per_dollar",
  "roi or dil project": "roi_or_dil_project",
  "type of outcome data": "type_of_outcome_data",
  "type of counterfactual data": "type_of_counterfactual_data",
  "evidence quality assessment": "evidence_quality_assessment",
  "execution risk": "execution_risk",
  "leadership gender": "leadership_gender",
  "leadership ethnicity": "leadership_ethnicity",
  "leadership ethnicity collapsed": "leadership_ethnicity_collapsed",
  "women impacted percent": "women_impacted_percent",
  "historically marginalized percent": "historically_marginalized_percent",
  "immigrants or refugees": "immigrants_or_refugees",
  "justice involved": "justice_involved",
  lgbtq: "lgbtq",
};

function parseNumber(value: string | undefined): number | null {
  if (!value || value === "-" || value === "" || value === "N/A") return null;
  // Remove currency symbols, commas, percent signs
  const cleaned = value.replace(/[$,%\s]/g, "").replace(/,/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

function parseRow(
  row: string[],
  headerIndices: Map<keyof GrantRecord, number>
): GrantRecord {
  const get = (field: keyof GrantRecord): string =>
    row[headerIndices.get(field) ?? -1] ?? "";

  return {
    grantee_id: parseNumber(get("grantee_id")) ?? 0,
    reference_number: get("reference_number"),
    grantee_name: get("grantee_name"),
    grant_title: get("grant_title"),
    grantee_country: get("grantee_country"),
    state: get("state"),
    program_officer: get("program_officer"),
    rfp: get("rfp"),
    grant_portfolio_type: get("grant_portfolio_type") as GrantRecord["grant_portfolio_type"],
    intervention_area_primary: get("intervention_area_primary"),
    intervention_area_secondary: get("intervention_area_secondary"),
    impact_pathway: get("impact_pathway"),
    labor_market_sector: get("labor_market_sector"),
    project_mechanism: get("project_mechanism"),
    primary_population_focus: get("primary_population_focus"),
    strategic_alignment: get("strategic_alignment"),

    grant_amount: parseNumber(get("grant_amount")),
    total_investment_including_overhead: parseNumber(get("total_investment_including_overhead")),
    total_grant_amount_committed: parseNumber(get("total_grant_amount_committed")),
    additional_co_investment_amounts: parseNumber(get("additional_co_investment_amounts")),
    cost_per_person: parseNumber(get("cost_per_person")),

    grant_approval_date: get("grant_approval_date") || null,
    grant_start_date: get("grant_start_date") || null,
    grant_close_date: get("grant_close_date") || null,
    grant_years_length: parseNumber(get("grant_years_length")),
    fiscal_year: parseNumber(get("fiscal_year")),
    quarter: get("quarter"),
    fiscal_year_and_quarter: get("fiscal_year_and_quarter"),
    active: parseBoolean(get("active")),

    estimated_total_people_served: parseNumber(get("estimated_total_people_served")),
    original_estimate_total_people_served: parseNumber(get("original_estimate_total_people_served")),
    pct_earning_below_living_wage: parseNumber(get("pct_earning_below_living_wage")),
    estimated_people_impacted_below_living_wage: parseNumber(get("estimated_people_impacted_below_living_wage")),
    pct_earning_above_living_wage_due_to_intervention: parseNumber(get("pct_earning_above_living_wage_due_to_intervention")),
    estimated_people_earning_above_living_wage: parseNumber(get("estimated_people_earning_above_living_wage")),
    living_wage_threshold: parseNumber(get("living_wage_threshold")),
    comparison_income_avg: parseNumber(get("comparison_income_avg")),
    post_intervention_income_avg: parseNumber(get("post_intervention_income_avg")),
    intervention_income_change_avg: parseNumber(get("intervention_income_change_avg")),
    pct_change_in_annual_income: parseNumber(get("pct_change_in_annual_income")),
    undiscounted_aggregate_lifetime_income: parseNumber(get("undiscounted_aggregate_lifetime_income")),
    present_value_lifetime_income_gain: parseNumber(get("present_value_lifetime_income_gain")),
    roi_lifetime_income_gain: parseNumber(get("roi_lifetime_income_gain")),
    relative_roi_dil: parseNumber(get("relative_roi_dil")),
    lifetime_earnings_increase_per_person: parseNumber(get("lifetime_earnings_increase_per_person")),
    undiscounted_lifetime_earnings_increase_per_person: parseNumber(get("undiscounted_lifetime_earnings_increase_per_person")),
    number_dil_equivalent: parseNumber(get("number_dil_equivalent")),
    number_dil_people_per_dollar: parseNumber(get("number_dil_people_per_dollar")),
    roi_or_dil_project: get("roi_or_dil_project"),
    type_of_outcome_data: get("type_of_outcome_data"),
    type_of_counterfactual_data: get("type_of_counterfactual_data"),
    evidence_quality_assessment: get("evidence_quality_assessment"),
    execution_risk: get("execution_risk"),

    leadership_gender: get("leadership_gender"),
    leadership_ethnicity: get("leadership_ethnicity"),
    leadership_ethnicity_collapsed: get("leadership_ethnicity_collapsed"),
    women_impacted_percent: parseNumber(get("women_impacted_percent")),
    historically_marginalized_percent: parseNumber(get("historically_marginalized_percent")),
    immigrants_or_refugees: get("immigrants_or_refugees"),
    justice_involved: get("justice_involved"),
    lgbtq: get("lgbtq"),
  };
}

function toCondensed(grant: GrantRecord): CondensedGrant {
  return {
    ref: grant.reference_number,
    name: grant.grantee_name,
    title: grant.grant_title,
    country: grant.grantee_country,
    state: grant.state,
    rfp: grant.rfp,
    portfolio_type: grant.grant_portfolio_type,
    intervention: grant.intervention_area_primary,
    impact_pathway: grant.impact_pathway,
    labor_market_sector: grant.labor_market_sector,
    project_mechanism: grant.project_mechanism,
    population: grant.primary_population_focus,
    amount: grant.grant_amount,
    people_served: grant.estimated_total_people_served,
    roi: grant.roi_lifetime_income_gain,
    income_change_pct: grant.pct_change_in_annual_income,
    cost_per_person: grant.cost_per_person,
    active: grant.active,
    program_officer: grant.program_officer,
  };
}

function buildPortfolioSummary(grants: GrantRecord[]): PortfolioSummary {
  const countries = [...new Set(grants.map((g) => g.grantee_country).filter(Boolean))];
  const rfpCohorts = [...new Set(grants.map((g) => g.rfp).filter((r) => r && r !== "-"))];
  const portfolioTypes: Record<string, number> = {};
  for (const g of grants) {
    if (g.grant_portfolio_type) {
      portfolioTypes[g.grant_portfolio_type] = (portfolioTypes[g.grant_portfolio_type] || 0) + 1;
    }
  }

  return {
    total_grants: grants.length,
    total_invested: grants.reduce((sum, g) => sum + (g.grant_amount ?? 0), 0),
    countries,
    active_grants: grants.filter((g) => g.active).length,
    rfp_cohorts: rfpCohorts,
    portfolio_types: portfolioTypes,
  };
}

export async function fetchGrantsFromSheet(): Promise<GrantRecord[]> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "'grantee info'!A:EE", // First tab, wide range to capture all columns
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) {
    throw new Error("No data found in spreadsheet");
  }

  // First row is headers
  const headers = rows[0].map((h: string) => String(h).toLowerCase().trim());

  // Build a mapping from our field names to column indices
  const headerIndices = new Map<keyof GrantRecord, number>();
  for (let i = 0; i < headers.length; i++) {
    const mapped = HEADER_MAP[headers[i]];
    if (mapped && !headerIndices.has(mapped)) {
      headerIndices.set(mapped, i);
    }
  }

  // Parse each data row
  const grants: GrantRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    // Skip rows without a reference number
    const refIdx = headerIndices.get("reference_number");
    if (refIdx === undefined || !row[refIdx]) continue;
    grants.push(parseRow(row.map(String), headerIndices));
  }

  return grants;
}

export async function getGrantRegistry(): Promise<GrantRegistry> {
  const now = Date.now();
  if (cachedRegistry && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRegistry;
  }

  const grants = await fetchGrantsFromSheet();
  const condensed = grants.map(toCondensed);
  const summary = buildPortfolioSummary(grants);

  cachedRegistry = {
    portfolio_summary: summary,
    grants: condensed,
    last_updated: new Date().toISOString(),
  };
  cacheTimestamp = now;

  return cachedRegistry;
}

// Force cache refresh
export async function refreshGrantRegistry(): Promise<GrantRegistry> {
  cachedRegistry = null;
  cacheTimestamp = 0;
  return getGrantRegistry();
}

// Get full grant records (not condensed) - used when we need all fields
export async function getFullGrantRecords(): Promise<GrantRecord[]> {
  return fetchGrantsFromSheet();
}
