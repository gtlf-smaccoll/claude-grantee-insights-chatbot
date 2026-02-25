# GitLab Foundation RAG Chatbot — Architecture & Implementation Spec

## For use with Claude Code to rebuild as a Next.js application

---

## 1. The Data You Have

### 1.1 Grantee Impact Dataset (Google Sheet — 117 columns, ~150 grants)

This is your **structured knowledge graph**. Key field groups:

**Identity & Classification**
- `grantee_id` (sequential), `Reference Number` (e.g., "2025067", "2023001A")
- `grantee name`, `grantee country`, `state`, `program officer`
- `RFP` — cohort grouping (8 values: "AI for Economic Opportunity 1.0/2.0/3.0", "Learning for Action Fund 2024/2025", "Green Jobs for Economic Opportunity", "Powering Economic Opportunity Fund", or "-" for non-RFP grants)
- `grant portfolio type` — "Laboratory", "Scaling", "Systems Change"
- `intervention area primary` — 12 categories (Workforce Skills and Training, Job Placement and Career Pathways, Public Benefits Access, etc.)
- `intervention area secondary`
- `Impact Pathway` — 7 values (Training & Skilling, Job Matching & Placement, Evidence Building & Learning, etc.)
- `Labor Market Sector` — 5 values (Tech & Digital Economy, Green & Climate Jobs, Sector Agnostic, etc.)
- `Project Mechanism` — 11 values (Direct Service, Digital Platform & Technology, Research & Evidence, etc.)
- `Primary Population Focus` — 4 values (Low-Income, Women, Opportunity Youth, Immigrants/Refugees/Migrants)
- `strategic alignment` — country or "Labor Market Systems Change"

**Financial**
- `grant amount`, `total investment including overhead`, `total grant amount committed`
- `additional co-investment amounts`
- `cost per person`

**Timeline & Status**
- `grant approval date`, `grant start date`, `grant close date`, `Grant Years Length`
- `fiscal year`, `Quarter`, `Fiscal Year and Quarter`
- `active` (0/1)
- `kickoff call completed`, `mid-year check-in completed`, `sent annual survey?`

**Impact & ROI Modeling (the crown jewels)**
- `estimated total people served`, `original estimate total people served`
- `pct earning below living wage`, `estimated people impacted below a living wage`
- `pct earning above living wage due to intervention`, `estimated people earning above living wage due to intervention`
- `Living Wage Threshold`
- `comparison income avg` (counterfactual), `post-intervention income avg`
- `intervention income change avg`, `pct change in annual income`
- `undiscounted aggregate lifetime income`, `present value of aggregate lifetime income gain estimate`
- `ROI lifetime income gain`, `Relative ROI DIL`
- `lifetime earnings increase per person`, `undiscounted lifetime earnings increase per person`
- `Number Double Income for Life Equivalent`, `Number DIL People per Dollar`
- `ROI or DIL Project` — whether modeled as ROI or DIL
- `type of outcome data`, `type of counterfactual data`
- `evidence quality assessment`, `execution risk`
- Running totals for portfolio-level ROI tracking

**Demographics**
- `leadership gender`, `leadership ethnicity`, `leadership ethnicity collapsed`
- `women impacted percent`, `historically marginalized percent`
- `immigrants or refugees`, `justice involved`, `lgbtq`

### 1.2 Document Types (per grant, linked by Reference Number)

Each grant may have up to 5 document types. Filenames follow conventions like:
`{ReferenceNumber}_{GranteeName}_{RFP}_{DocumentType}.pdf` or `{GranteeName}_MidCheckInTranscript_{Year}.docx`

| Document Type | Availability | Content | Best For Answering |
|---|---|---|---|
| **Grant Description** | ~All grants | Project plan, scope, partnerships, budget, timeline, intended outcomes, theory of change | "What is this project?", "Who are they partnering with?", "What's the theory of change?" |
| **Midpoint Check-in Transcript** | ~Most grants | 20-40 min video call transcript between GitLab Foundation program officers and grantee leadership. Conversational, candid. Covers progress updates, early challenges, pivots, data/measurement developments, org-level strategy shifts, future plans. Heavy on small talk and relationship-building at start/end. | "What challenges surfaced at the midpoint?", "What pivots are orgs making?", "How is recruitment/outreach going?" |
| **Midpoint Survey** (structured) | **Only 14 grants** in AI Fund 2.0 cohort | 4 structured questions: stage, progress, early signals, challenges | "Where were AIEO 2.0 grantees at midpoint?", "What early challenges emerged in the AI cohort?" |
| **Annual Impact Survey** | Grants with completed grant year | Structured Q&A: breadth/scale, depth/outcomes, learnings, challenges, plans, feedback | "What results did they achieve?", "What challenges did they face?", "What did they learn?" |
| **Closeout Transcript** | Grants nearing/at completion | Full conversation transcript (~30-60 pages) with candid discussion of results, challenges, political dynamics, plans | "What's the real story?", "What insights emerged?", "What are they planning next?" |

**Key distinction:** Midpoint check-in transcripts exist for most of the ~150 grants and are the primary midpoint data source. They are conversational recordings (not structured surveys). The structured midpoint survey is only for the 14 AIEO 2.0 grantees.

---

## 2. Architecture

### 2.1 Data Model

Every chunk stored in the vector database gets this metadata:

```typescript
interface ChunkMetadata {
  // From Google Sheet (structured lookup)
  reference_number: string;        // "2025067"
  grantee_id: number;              // 93
  grantee_name: string;            // "Burnes Center for Social Change"
  grantee_country: string;         // "United States of America"
  state: string;                   // "Massachusetts" or "National"
  program_officer: string;         // "Matt Zieger"
  rfp: string;                     // "AI for Economic Opportunity 2.0"
  grant_portfolio_type: string;    // "Laboratory" | "Scaling" | "Systems Change"
  intervention_area_primary: string; // "Workforce Development Systems"
  intervention_area_secondary: string;
  impact_pathway: string;          // "Evidence Building & Learning"
  labor_market_sector: string;     // "Sector Agnostic"
  project_mechanism: string;       // "Research & Evidence"
  primary_population_focus: string; // "Low-Income"
  grant_amount: number;            // 250000
  grant_title: string;
  active: boolean;
  fiscal_year: number;
  
  // Document-level metadata
  document_type: "grant_description" | "midpoint_checkin_transcript" | "midpoint_survey" | "impact_survey" | "closeout_transcript";
  document_date: string;           // ISO date for chronological ordering
  source_file: string;             // original filename
  drive_url: string;               // Google Drive link
  
  // Chunk-level metadata
  chunk_index: number;
  chunk_uid: string;
  section_type: string;            // e.g., "project_summary", "challenges", "outcomes", "learnings"
  section_heading: string;         // original heading text
  
  // Pre-computed from impact data
  roi: number;                     // ROI lifetime income gain
  people_served: number;           // estimated total people served
  cost_per_person: number;
  income_change_pct: number;       // pct change in annual income
}
```

### 2.2 Grant Summary Cards

At ingestion time, for each grantee, generate a structured summary using Claude:

```typescript
interface GrantSummaryCard {
  reference_number: string;
  grantee_name: string;
  one_liner: string;              // 1-sentence description
  project_summary: string;        // 2-3 sentences
  key_findings: string[];         // Top 3-5 findings
  challenges: string[];           // Top challenges
  outcomes_summary: string;       // Key metrics in plain language
  current_status: string;         // Active, completed, scaling, etc.
  follow_on_plans: string;        // What's next
  
  // Structured metrics from the spreadsheet
  metrics: {
    grant_amount: number;
    people_served: number;
    roi: number;
    income_change_pct: number;
    cost_per_person: number;
    co_investment: number;
  };
}
```

Store these as both JSON (for programmatic access) and as text chunks (for vector search). These cards become the "fast path" for portfolio-level questions.

### 2.3 Two-Layer Retrieval Architecture

```
User Query
    │
    ▼
┌─────────────────────┐
│  Query Classifier    │  (Claude Haiku — fast, cheap)
│  Detects:            │
│  - grantee names     │
│  - countries         │
│  - RFP/cohort names  │
│  - intervention areas│
│  - query type        │
│  - metric references │
└─────────┬───────────┘
          │
    ┌─────┴──────┐
    ▼            ▼
┌────────┐  ┌──────────┐
│Structured│ │ Semantic  │
│ Lookup  │  │  Search   │
│(metadata│  │ (vector)  │
│ filter) │  │           │
└────┬───┘  └─────┬────┘
     │            │
     ▼            ▼
┌─────────────────────┐
│   Merge & Rank      │
│   (deduplicate,     │
│    diversify,       │
│    rerank)          │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Claude Sonnet     │
│   (generate answer  │
│    with citations)  │
└─────────────────────┘
```

**Query Type Routing:**

| Query Type | Example | Retrieval Strategy |
|---|---|---|
| Single grantee deep-dive | "Tell me about Burnes Center" | Pull ALL docs for that grant via reference_number + summary card |
| Cohort comparison | "How is AIEO 2.0 cohort doing?" | Filter by RFP, pull summary cards + impact survey chunks |
| Country comparison | "Compare Kenya vs Colombia outcomes" | Filter by country, pull summary cards + key metrics |
| Thematic analysis | "What are common challenges?" | Vector search across all impact surveys + transcripts, section_type="challenges" |
| Metrics question | "Which grantees have highest ROI?" | Direct spreadsheet query — no vector search needed |
| Portfolio overview | "How are we doing overall?" | Aggregate spreadsheet metrics + summary cards |

### 2.4 The Spreadsheet as Structured Context

For **every** query, include a condensed version of the spreadsheet in the system prompt or as a document block. This gives Claude the ability to reason about the full portfolio without retrieval.

Create a condensed JSON registry (~5-10KB) with the key fields per grant:

```json
{
  "portfolio_summary": {
    "total_grants": 150,
    "total_invested": 54800000,
    "countries": ["United States", "Colombia", "Kenya"],
    "active_grants": 87,
    "portfolio_roi": 222
  },
  "grants": [
    {
      "ref": "2025067",
      "name": "Burnes Center for Social Change",
      "title": "NJ Pilot - Skills-First Talent Management",
      "country": "United States of America",
      "rfp": "AI for Economic Opportunity 2.0",
      "intervention": "Workforce Development Systems",
      "amount": 250000,
      "people_served": 24,
      "roi": null,
      "active": true,
      "population": "Low-Income"
    }
    // ... all 150 grants
  ]
}
```

This is small enough to include in every request and gives Claude instant lookup for any grantee or cohort — no retrieval latency.

---

## 3. Chunking Strategy (by document type)

### 3.1 Grant Descriptions
- Chunk by **section**: project summary, scope of work, partnerships, technology use, timeline, outcomes (who/how many/what impact), measurement, budget
- Tag each chunk with `section_type`
- Keep the "Project Summary" as a single chunk even if >1000 chars
- The "Outcomes" section (Who? How Many? What Impact?) should be 1-2 chunks max

### 3.2 Midpoint Check-in Transcripts (~150 grants, most common midpoint data)

These are 20-40 minute video call recordings between GitLab Foundation program officers (Matt Zieger, Kali Shebi, Geetika Malhotra, Spencer MacColl) and grantee leadership. They have specific characteristics that affect chunking:

**Structure pattern observed:**
1. ~15-25% small talk / greetings / scheduling logistics at the start
2. ~60-70% substantive discussion: progress updates, challenges, data, pivots, strategy
3. ~10-15% wrap-up: future plans, support requests, relationship-building, goodbyes

**Chunking approach:**
- **Strip the small talk.** Pre-process with Claude to identify where substantive discussion begins and ends. The Toolkit transcript opens with 3,800+ characters of workout routines and travel plans before any grant content. The Solar Sister transcript has similar. This noise dilutes retrieval quality.
- **Chunk by topic segment, not character count.** Use Claude (Haiku, batch mode) to segment the substantive middle into topic blocks:
  - Progress updates / milestones
  - Challenges and obstacles
  - Pivots or strategy changes
  - Data and measurement developments
  - Org-level changes (staffing, strategy, partnerships)
  - Future plans and next steps
  - Support requests from GitLab Foundation
  - Notable quotes or anecdotes
- **Preserve speaker attribution.** Tag who is speaking — grantee voice vs. program officer questions. When the chatbot user asks "what challenges did Solar Sister face?", the answer should come from Solar Sister's voice, not the program officer's question.
- **Generate a transcript summary** (300-500 words) as an additional chunk, capturing the key takeaways. This is especially useful for portfolio-level queries like "what are common midpoint challenges?"

**Example topic segments from Toolkit transcript:**
- Progress: International Institute of Welding membership (first in East Africa)
- Progress: Surpassed 40% girls enrollment target (from <20%)
- Innovation: Mobile welding unit in Madaré slums for teenage mothers
- Challenge: Unable to eliminate unpaid 3-month attachment period
- Challenge: Employers still don't fully trust graduates to work independently
- Strategy: Spring Impact UK mentorship for strategic growth
- Future: Establishing first-class welding testing lab for IIW accreditation
- Request: Support for Learning for Action Fund application

**Example topic segments from Solar Sister transcript:**
- Org update: Expanding beyond product distribution to business equipment (solar mills, refrigeration, leasing)
- Progress: Serial number tracking pilot with Teraworks in Kenya
- Technology: AI-powered SMS chatbot development with Skillwell (via Tech to the Rescue, pro bono)
- Challenge: Aligning technology timing with operational/programmatic readiness
- Challenge: AI chatbot bug — processing answers but failing to send responses back
- Data: SSE Listening Series (45 qualitative interviews/month), annual survey (100/country)
- Data: Alumni survey with Andy — 500 former entrepreneurs on long-term impact
- Model: Sisterhood groups and role modeling as primary adoption mechanism

### 3.3 Midpoint Surveys (ONLY 14 grants — AI Fund 2.0 cohort)
- These are short (4 questions). Store as a **single document** (no chunking) or at most 4 chunks (one per question)
- Tag with `section_type`: "stage", "progress", "early_signals", "challenges"
- **Important:** Do not conflate these with midpoint check-in transcripts. These exist ONLY for 14 AIEO 2.0 grants.

### 3.4 Annual Impact Surveys
- Chunk by **question-answer pair**, tagged with section_type:
  - "breadth_scale" — stage, users, institutional partners
  - "depth_outcomes" — time/effort savings, economic benefits, process changes
  - "learnings" — lessons learned
  - "challenges" — top challenges
  - "future_plans" — next 12-24 months
  - "feedback" — cohort experience, relationship feedback
  - "financial" — co-investment, additional funding
- Each Q&A pair stays together as one chunk

### 3.5 Closeout Transcripts
- Same conversational structure as midpoint check-ins but longer (~30-60 pages) and richer
- **Same approach:** strip small talk, segment by topic, preserve speaker attribution
- Pre-process with Claude to identify topic boundaries and generate summary
- Each topic segment becomes one chunk, tagged with `section_type`
- Also generate a **transcript summary** (500-1000 words) stored as an additional chunk
- These often contain the most candid, insightful material in the entire grant record

---

## 4. System Prompt (Revised)

```
You are a senior grants analyst for the GitLab Foundation. You have deep expertise in 
international development, grantmaking, program evaluation, and impact measurement.

## Portfolio Context

You have access to GitLab Foundation's full grant portfolio data. The foundation funds 
projects focused on economic opportunity across three countries: the United States, 
Colombia, and Kenya. Grants are organized into cohorts (RFPs) including AI for Economic 
Opportunity (3 rounds), Learning for Action Fund, Green Jobs, and Powering Economic 
Opportunity. The portfolio is categorized by type: Laboratory (early-stage), Scaling 
(proven models), and Systems Change (field-building).

Your knowledge base includes five document types per grantee:
1. **Grant Descriptions** — project plans, theory of change, intended outcomes
2. **Midpoint Check-in Transcripts** (~150 grants) — candid video call conversations covering progress, challenges, pivots, and strategy at the halfway point
3. **Midpoint Surveys** (14 AI Fund 2.0 grants only) — structured 4-question progress checks
4. **Annual Impact Surveys** — structured end-of-year outcome data
5. **Closeout Transcripts** — candid end-of-grant conversations revealing real-world dynamics

The midpoint and closeout transcripts often contain the most honest, nuanced insights — challenges that don't appear in structured surveys, political dynamics, candid assessments of what worked and what didn't. Weight these heavily for qualitative questions.

## How to Respond

Adapt your format to the question. Short questions get short answers. Complex analytical 
questions get structured analysis. Don't force a rigid template on every response.

Key principles:
- Lead with the most important insight, not background
- Use specific numbers: grant amounts, ROI, people served, income changes, cost per person
- When comparing grantees, use tables
- Cite specific documents — every claim should be traceable
- Distinguish between projected/estimated outcomes and actual measured outcomes
- When discussing challenges, explain root causes, not just symptoms
- Note the chronological arc: what they planned → what happened at midpoint → where they ended up
- If evidence is limited (fewer than 3 relevant chunks), say so explicitly

## What NOT to Do
- Don't give generic answers that could apply to any foundation
- Don't repeat the question back
- Don't force follow-up questions on every response — only suggest them when natural
- Don't summarize what you're about to say before saying it
```

---

## 5. Technical Stack for Next.js App

### Core
- **Next.js 14+** (App Router)
- **Vercel AI SDK** (`ai` package) — streaming chat with React components
- **Anthropic JS SDK** — Claude API with citations
- **NextAuth.js** — Google OAuth (restrict to @gitlabfoundation.org domain)

### Data Layer
- **Google Sheets API** — read the grantee impact dataset on a schedule
- **Google Drive API** — access grant documents from Drive folders
- **Pinecone** or **Supabase pgvector** — vector store with metadata filtering
- **Voyage AI** — embeddings + reranking (you're already using this)

### Ingestion Pipeline (separate from the web app)
- Can remain Python or port to Node
- Runs on schedule (daily/weekly) or triggered by webhook
- Reads Google Sheet → updates grant registry JSON
- Checks Drive folders for new/updated documents
- Chunks documents with type-aware strategy
- Generates embeddings and upserts to vector store
- Generates/updates summary cards for changed grants

### Key API Routes
- `POST /api/chat` — main chat endpoint with streaming
- `GET /api/grants` — returns grant registry for sidebar/search
- `GET /api/grants/[id]` — returns full grant details + summary card
- `POST /api/ingest` — trigger re-ingestion (admin only)

---

## 6. Google Sheet Integration Detail

The sheet at `1O-H3flSzzhJe0STGN1jaFUx494jtwWgocUk_3jGrjc4` uses `IMPORTRANGE` from a source sheet at `1F3WaMBTnan0HmfmgsGqyGfrglD8DJXYHHF1Hgg7_ldA`. 

**Important:** The Excel export contains the formulas, not computed values. Your app should either:
1. Read directly from the Google Sheet API (preferred — gets live computed values)
2. Export as CSV/values-only before ingestion

**Sync strategy:**
- Use Google Sheets API `spreadsheets.values.get` to read the full sheet
- Cache locally with a TTL (e.g., 1 hour)
- On each chat request, use the cached version
- Background job refreshes the cache periodically

---

## 7. Query Examples & Expected Behavior

### Example 1: "Tell me about the Burnes Center project"
**Route:** Single grantee deep-dive
**Retrieval:**
1. Look up "Burnes Center" → ref 2025067
2. Pull summary card
3. Pull all document chunks for 2025067 (grant description, midpoint, impact survey, transcript)
4. Include spreadsheet row data (grant amount, people served, ROI)
**Claude receives:** Complete dossier — should produce a 360° analysis

### Example 2: "Which grantees have the highest ROI?"
**Route:** Metrics question
**Retrieval:**
1. Sort grant registry by `ROI lifetime income gain` descending
2. Pull top 10 with summary cards
3. No vector search needed
**Claude receives:** Structured data — should produce a ranked table

### Example 3: "What challenges are AIEO 2.0 grantees facing with adoption?"
**Route:** Thematic + cohort filter
**Retrieval:**
1. Filter by RFP = "AI for Economic Opportunity 2.0"
2. Vector search within that subset for "adoption challenges"
3. Weight toward impact survey `section_type="challenges"` and transcript topic segments
**Claude receives:** Challenge-related chunks from multiple AIEO 2.0 grantees

### Example 4: "Compare Kenya workforce training outcomes to Colombia"
**Route:** Country + intervention comparison
**Retrieval:**
1. Filter grants: country=Kenya, intervention=Workforce Skills and Training
2. Filter grants: country=Colombia, intervention=Workforce Skills and Training
3. Pull summary cards + impact metrics for both groups
**Claude receives:** Structured comparison data — should produce a table + narrative

---

## 8. Migration Priorities

**Phase 1 — Foundation (Week 1-2)**
- Next.js app scaffold with Vercel AI SDK streaming chat
- Google OAuth via NextAuth
- Google Sheets API integration → grant registry JSON
- Basic chat UI with streaming responses

**Phase 2 — Intelligent Retrieval (Week 2-3)**
- Document-type-aware chunking pipeline
- Vector store with rich metadata
- Query classifier (Haiku)
- Structured filtering + semantic search
- Grant summary card generation

**Phase 3 — Polish (Week 3-4)**
- Citation rendering (inline, expandable)
- Grant profile sidebar/cards
- Cohort/portfolio dashboard views
- Evidence panel (optional, for power users)
- Mobile responsive design

**Phase 4 — Live Integration (Week 4+)**
- Google Drive sync for new documents
- Scheduled Google Sheet refresh
- Re-ingestion pipeline for updated documents
- Admin panel for monitoring
