export interface GrantRecord {
  // Identity & Classification
  grantee_id: number;
  reference_number: string;
  grantee_name: string;
  grant_title: string;
  grantee_country: string;
  state: string;
  program_officer: string;
  rfp: string;
  grant_portfolio_type: "Laboratory" | "Scaling" | "Systems Change" | "";
  intervention_area_primary: string;
  intervention_area_secondary: string;
  impact_pathway: string;
  labor_market_sector: string;
  project_mechanism: string;
  primary_population_focus: string;
  strategic_alignment: string;

  // Financial
  grant_amount: number | null;
  total_investment_including_overhead: number | null;
  total_grant_amount_committed: number | null;
  additional_co_investment_amounts: number | null;
  cost_per_person: number | null;

  // Timeline & Status
  grant_approval_date: string | null;
  grant_start_date: string | null;
  grant_close_date: string | null;
  grant_years_length: number | null;
  fiscal_year: number | null;
  quarter: string;
  fiscal_year_and_quarter: string;
  active: boolean;

  // Impact & ROI
  estimated_total_people_served: number | null;
  original_estimate_total_people_served: number | null;
  pct_earning_below_living_wage: number | null;
  estimated_people_impacted_below_living_wage: number | null;
  pct_earning_above_living_wage_due_to_intervention: number | null;
  estimated_people_earning_above_living_wage: number | null;
  living_wage_threshold: number | null;
  comparison_income_avg: number | null;
  post_intervention_income_avg: number | null;
  intervention_income_change_avg: number | null;
  pct_change_in_annual_income: number | null;
  undiscounted_aggregate_lifetime_income: number | null;
  present_value_lifetime_income_gain: number | null;
  roi_lifetime_income_gain: number | null;
  relative_roi_dil: number | null;
  lifetime_earnings_increase_per_person: number | null;
  undiscounted_lifetime_earnings_increase_per_person: number | null;
  number_dil_equivalent: number | null;
  number_dil_people_per_dollar: number | null;
  roi_or_dil_project: string;
  type_of_outcome_data: string;
  type_of_counterfactual_data: string;
  evidence_quality_assessment: string;
  execution_risk: string;

  // Demographics
  leadership_gender: string;
  leadership_ethnicity: string;
  leadership_ethnicity_collapsed: string;
  women_impacted_percent: number | null;
  historically_marginalized_percent: number | null;
  immigrants_or_refugees: string;
  justice_involved: string;
  lgbtq: string;
}

// Condensed version for the grant registry included in every chat request.
// Uses abbreviated keys to minimize token usage while giving Claude full
// access to all spreadsheet columns so users can ask any data question.
export interface CondensedGrant {
  // Identity & Classification
  ref: string;
  name: string;
  title: string;
  country: string;
  state: string;
  rfp: string;
  portfolio_type: string;
  intervention: string;
  intervention_2: string;
  impact_pathway: string;
  labor_market_sector: string;
  project_mechanism: string;
  population: string;
  strategic_alignment: string;
  program_officer: string;

  // Financial
  amount: number | null;
  total_investment: number | null;
  total_committed: number | null;
  co_investment: number | null;
  cost_per_person: number | null;

  // Timeline & Status
  approval_date: string | null;
  start_date: string | null;
  close_date: string | null;
  grant_years: number | null;
  fiscal_year: number | null;
  quarter: string;
  fy_quarter: string;
  active: boolean;

  // Impact & ROI
  people_served: number | null;
  original_est_people: number | null;
  pct_below_living_wage: number | null;
  people_below_living_wage: number | null;
  pct_above_living_wage: number | null;
  people_above_living_wage: number | null;
  living_wage_threshold: number | null;
  comparison_income: number | null;
  post_intervention_income: number | null;
  income_change_avg: number | null;
  income_change_pct: number | null;
  undiscounted_lifetime_income: number | null;
  pv_lifetime_income_gain: number | null;
  roi: number | null;
  relative_roi_dil: number | null;
  lifetime_earnings_per_person: number | null;
  undiscounted_earnings_per_person: number | null;
  dil_equivalent: number | null;
  dil_per_dollar: number | null;
  roi_or_dil_project: string;
  outcome_data_type: string;
  counterfactual_type: string;
  evidence_quality: string;
  execution_risk: string;

  // Demographics
  leadership_gender: string;
  leadership_ethnicity: string;
  leadership_ethnicity_short: string;
  women_impacted_pct: number | null;
  marginalized_pct: number | null;
  immigrants_refugees: string;
  justice_involved: string;
  lgbtq: string;
}

export interface PortfolioSummary {
  total_grants: number;
  total_invested: number;
  countries: string[];
  active_grants: number;
  rfp_cohorts: string[];
  portfolio_types: Record<string, number>;
}

export interface GrantRegistry {
  portfolio_summary: PortfolioSummary;
  grants: CondensedGrant[];
  last_updated: string;
}

// AI-generated summary card for a grant (cached in Pinecone)
export interface GrantSummaryCard {
  reference_number: string;
  grantee_name: string;
  one_liner: string;
  project_summary: string;
  key_findings: string[];
  challenges: string[];
  outcomes_summary: string;
  current_status: string;
  follow_on_plans: string;
  metrics: {
    grant_amount: number | null;
    people_served: number | null;
    roi: number | null;
    income_change_pct: number | null;
    cost_per_person: number | null;
    co_investment: number | null;
  };
  generated_at: string;
  has_documents: boolean;
  document_types_used: string[];
}

// AI-generated comparative analysis for 2-3 grants
export interface GrantComparisonAnalysis {
  overall_assessment: string;
  goal_completion: {
    leader: string;
    analysis: string;
  };
  roi_performance: {
    leader: string;
    analysis: string;
  };
  challenges_comparison: {
    hardest: string;
    analysis: string;
  };
  key_differences: string[];
  recommendation: string;
}

// Similar grant result from Pinecone semantic search
export interface SimilarGrantResult {
  reference_number: string;
  grantee_name: string;
  grantee_country: string;
  intervention_area_primary: string;
  primary_population_focus: string;
  grant_portfolio_type: string;
  impact_pathway: string;
  grant_amount: number | null;
  active: boolean;
  similarity_score: number;
  matching_chunk_count: number;
  one_liner: string | null;
}

export interface SimilarGrantsResponse {
  source_reference: string;
  results: SimilarGrantResult[];
}

// AI-generated introduction rationale for connecting two grantees
export interface IntroductionRationale {
  commonalities: string[];
  learning_opportunities: {
    source_can_learn: string;
    target_can_learn: string;
  };
  introduction_message: string;
}

// AI-generated peer insights from similar grants' documents
export interface PeerInsights {
  challenges_faced: string[];
  what_worked: string[];
  practical_advice: string[];
  source_grants: string[];
}

// Column mapping from spreadsheet headers to our field names
export type ColumnMapping = Record<string, keyof GrantRecord>;
