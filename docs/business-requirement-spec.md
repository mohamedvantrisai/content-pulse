# Business Requirement Specification (BRS) — Content Pulse

**Product:** Content Pulse  
**Tagline:** Cross-Platform Content Analytics Aggregator  
**Version:** 1.0  
**Author:** Mohamed Riyas  
**Date:** February 21, 2026  
**Status:** Draft  
**Target Ecosystem:** Buffer Public API Platform  
**Platforms in Scope (v1):** Instagram, LinkedIn

---

## 1. Executive Summary

Content Pulse is a cross-platform content analytics aggregation API that collects, normalizes, and analyzes performance data from Instagram and LinkedIn through a unified **REST + GraphQL** interface, paired with a **React analytics dashboard**.

It serves:
- **Creators / small businesses** who need one consolidated view of content performance.
- **Developers / integrators** who need a clean, consistent analytics API across platforms.

**Core value proposition:** Content Pulse closes the gap between *seeing analytics* and *knowing what to do next* by aggregating cross-platform data into a single API call and generating deterministic, data-driven content recommendations (**no LLM required**).

---

## 2. Document Scope

This Document captures:
- Business context and the problem to solve
- Target users and success metrics
- Functional requirements (FRs) and acceptance criteria
- Non-functional requirements (NFRs)
- Platform API access assumptions and constraints
- Roadmap phases
- Risks and mitigations
- Glossary

---

## 3. Business Context

### 3.1 Problem Statement

#### 3.1.1 Creator Pain
Creators must check Instagram and LinkedIn analytics separately. Metrics use inconsistent terminology and formulas, making cross-platform understanding slow and error-prone.

#### 3.1.2 Developer Pain
Developers integrate two ecosystems with different OAuth flows, rate limits, pagination, error codes, and data formats. Unified analytics requires duplicated effort.

#### 3.1.3 Buffer Platform Inspiration
Analytics charts exist but don’t translate into decisions. The workflow breaks between “look at metrics” and “decide what to post next.” Analytics exposure is also a key developer desire.

### 3.2 The Gap Content Pulse Fills
Content Pulse turns data into decisions by producing a data-backed “content brief” (what worked, what to post next, when to post), computed deterministically from stored analytics.

---

## 4. Target Users & Personas

<table>
  <thead>
    <tr>
      <th>Persona</th>
      <th>Description</th>
      <th>Primary Need</th>
      <th>Content Pulse Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Solo Creator</td>
      <td>Individual managing IG + LI</td>
      <td>Quick weekly check without multiple logins</td>
      <td>Single API returns unified KPIs + trends</td>
    </tr>
    <tr>
      <td>Small Business Owner</td>
      <td>1–5 person team</td>
      <td>Know what’s working to repeat it</td>
      <td>Content brief with actionable recommendations</td>
    </tr>
    <tr>
      <td>Agency Manager</td>
      <td>Manages 5–20 client accounts</td>
      <td>Automated weekly reporting</td>
      <td>Programmatic report generation via API</td>
    </tr>
    <tr>
      <td>Developer / Integrator</td>
      <td>Building analytics tools</td>
      <td>Clean, consistent analytics API</td>
      <td>Unified REST + GraphQL with standard auth/rate limits</td>
    </tr>
  </tbody>
</table>


---

## 5. Goals, Non-Goals, and Assumptions

### 5.1 Business Goals
- Provide a unified analytics view for IG + LI for a chosen date range.
- Provide standardized platform abstraction for developers.
- Deliver deterministic “AI Content Strategist” recommendations.
- Provide a reference implementation aligned to Buffer’s public API direction.

### 5.2 Non-Goals (v1)
- Supporting additional platforms beyond Instagram and LinkedIn.
- Real-time analytics streaming (v1 is snapshot + periodic sync based).
- LLM-driven recommendations (explicitly avoided to remove hallucination risk).
- Full social publishing/scheduling workflows (only analytics-focused in v1).

### 5.3 Key Assumptions
- Users can connect accounts via OAuth (Meta + LinkedIn).
- Tokens are stored securely and refreshed via background jobs.
- Some LinkedIn analytics scopes may require partner approval; demo may rely on partial access or mocked analytics where needed.

---

## 6. Success Metrics

<table>
  <thead>
    <tr>
      <th>Metric</th>
      <th>Target</th>
      <th>Measurement</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>API response time (p95)</td>
      <td>&lt; 200ms cached, &lt; 500ms computed</td>
      <td>Server latency logs</td>
    </tr>
    <tr>
      <td>Normalization correctness</td>
      <td>Matches manual calculations</td>
      <td>Unit tests vs known data</td>
    </tr>
    <tr>
      <td>Dashboard load time</td>
      <td>&lt; 2s first meaningful paint</td>
      <td>Browser Performance API</td>
    </tr>
    <tr>
      <td>Test coverage</td>
      <td>&gt; 80% services and routes</td>
      <td>Jest coverage</td>
    </tr>
    <tr>
      <td>Developer onboarding</td>
      <td>First API call &lt; 5 minutes</td>
      <td>README walkthrough test</td>
    </tr>
    <tr>
      <td>Seed data realism</td>
      <td>IG ~6%, LI ~8% engagement rates</td>
      <td>Seed script validation</td>
    </tr>
  </tbody>
</table>


---

## 7. Functional Requirements

### 7.1 FR-100 — Cross-Platform Analytics Overview (P0)

**Description:** Aggregate analytics from all connected channels into a single response for a date range. This is the primary endpoint and dashboard foundation.

<table>
  <thead>
    <tr>
      <th style="white-space:nowrap;">Req ID</th>
      <th>Requirement</th>
      <th>Acceptance Criteria</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="white-space:nowrap;"><code>FR-101</code></td>
      <td>Accept start/end as ISO 8601 query parameters</td>
      <td>400 with helpful message for invalid dates</td>
    </tr>
    <tr>
      <td style="white-space:nowrap;"><code>FR-102</code></td>
      <td>Return total impressions, engagements, posts, avg engagement rate</td>
      <td>Numbers match manual sum of posts</td>
    </tr>
    <tr>
      <td style="white-space:nowrap;"><code>FR-103</code></td>
      <td>Return previous period comparison (same duration before start)</td>
      <td>% change computed correctly for all KPIs</td>
    </tr>
    <tr>
      <td style="white-space:nowrap;"><code>FR-104</code></td>
      <td>Per-platform breakdown with metrics per channel</td>
      <td>Each platform shows own totals and rate</td>
    </tr>
    <tr>
      <td style="white-space:nowrap;"><code>FR-105</code></td>
      <td>Daily time series: impressions, engagements, post count</td>
      <td>One point per day, sorted ascending</td>
    </tr>
    <tr>
      <td style="white-space:nowrap;"><code>FR-106</code></td>
      <td>Top 10 posts ranked by engagement rate</td>
      <td>Sorted desc; content truncated to 120 chars</td>
    </tr>
    <tr>
      <td style="white-space:nowrap;"><code>FR-107</code></td>
      <td>Total follower count across channels</td>
      <td>Sum of <code>Channel.followerCount</code></td>
    </tr>
  </tbody>
</table>

---

### 7.2 FR-200 — Channel Management (P0)

<table>
  <thead>
    <tr>
      <th>Req ID</th>
      <th>Requirement</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="white-space:nowrap">FR-201</td>
      <td>Connect Instagram via Meta OAuth 2.0 (Graph API)</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-202</td>
      <td>Connect LinkedIn via LinkedIn OAuth 2.0</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-203</td>
      <td>Store access + refresh tokens encrypted at rest (AES-256)</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-204</td>
      <td>List channels with sync status, follower count, last synced</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-205</td>
      <td>Pause/resume channel syncing via PATCH</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-206</td>
      <td>Disconnect channel (soft delete, retain historical posts)</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-207</td>
      <td>Auto-refresh expired tokens via background job</td>
    </tr>
  </tbody>
</table>


---

### 7.3 FR-300 — Per-Channel Analytics & Comparison (P1)

<table>
  <thead>
    <tr>
      <th>Req ID</th>
      <th>Requirement</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="white-space:nowrap">FR-301</td>
      <td>Time series at daily/weekly/monthly granularity for a single channel</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-302</td>
      <td>Content type breakdown (avg engagement per post type)</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-303</td>
      <td>Best posting times heatmap (day-of-week × hour-of-day) with min 2 posts/slot</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-304</td>
      <td>Channel summary (posts, impressions, engagements, followers, best post)</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-305</td>
      <td>Compare Instagram vs LinkedIn side-by-side with winner per metric</td>
    </tr>
  </tbody>
</table>


---

### 7.4 FR-400 — AI Content Strategist (P1)

**Design decision:** Insights computed from MongoDB aggregation pipelines + template-based natural language. No LLM. Deterministic, testable, no hallucinations.

<table>
  <thead>
    <tr>
      <th>Req ID</th>
      <th>Requirement</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="white-space:nowrap">FR-401</td>
      <td>Performance summary for last 30 days (posts, reach, etc.)</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-402</td>
      <td>Prioritize underperformance detection (3+ posts &lt; 50% avg)</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-403</td>
      <td>Concrete recommendation (format + schedule suggestion)</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-404</td>
      <td>Best next posting time from historical hourly engagement</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-405</td>
      <td>Content type suggestion based on highest-performing format</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-406</td>
      <td>Confidence level: high (20+), medium (8–19), low (&lt;8)</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-407</td>
      <td>Structured data points backing every claim</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-408</td>
      <td>Cache brief in Redis (TTL 1 hour)</td>
    </tr>
  </tbody>
</table>


---

### 7.5 FR-500 — API Key Management (P1)

<table>
  <thead>
    <tr>
      <th>Req ID</th>
      <th>Requirement</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="white-space:nowrap">FR-501</td>
      <td>Create key with name, scopes, configurable rate limit</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-502</td>
      <td>Full key shown once; store as bcrypt hash with prefix lookup</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-503</td>
      <td>List keys: name, prefix, scopes, last used, total requests</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-504</td>
      <td>Revoke key immediately and irreversibly</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-505</td>
      <td>Scopes: analytics:read, channels:read, channels:write, posts:read, reports:read</td>
    </tr>
  </tbody>
</table>


---

### 7.6 FR-600 — Authentication & Rate Limiting (P0)

<table>
  <thead>
    <tr>
      <th>Req ID</th>
      <th>Requirement</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="white-space:nowrap">FR-601</td>
      <td>Dual auth: API key (X-API-Key) + JWT (Bearer)</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-602</td>
      <td>Token bucket rate limiting per key, Redis-backed, default 60 req/min</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-603</td>
      <td>IETF rate limit headers: RateLimit-Limit/Remaining/Reset</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-604</td>
      <td>429 + Retry-After when exhausted</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-605</td>
      <td>Scope validation per endpoint</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-606</td>
      <td>Graceful degradation if Redis down (allow requests, log warning)</td>
    </tr>
  </tbody>
</table>


---

### 7.7 FR-700 — React Analytics Dashboard (P0)

<table>
  <thead>
    <tr>
      <th>Req ID</th>
      <th>Requirement</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="white-space:nowrap">FR-701</td>
      <td>Overview with 4 KPI cards + % change vs previous period</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-702</td>
      <td>Engagement area chart (impressions + engagements over time)</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-703</td>
      <td>Platform breakdown donut chart</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-704</td>
      <td>Channel performance cards grid</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-705</td>
      <td>Top posts table with platform badge, metrics, date</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-706</td>
      <td>Date range filter: 7d/14d/30d/60d/90d</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-707</td>
      <td>Channel detail page: time series, content breakdown, posting times</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-708</td>
      <td>AI Content Brief card on overview page</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-709</td>
      <td>Loading states, error boundaries, empty states</td>
    </tr>
    <tr>
      <td style="white-space:nowrap">FR-710</td>
      <td>Connect channel buttons triggering OAuth flows</td>
    </tr>
  </tbody>
</table>


---

## 8. Non-Functional Requirements

<table>
  <thead>
    <tr>
      <th>Category</th>
      <th>Requirement</th>
      <th>Target</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Performance</td>
      <td>REST API response (p95)</td>
      <td>&lt; 200ms cached, &lt; 500ms computed</td>
    </tr>
    <tr>
      <td>Performance</td>
      <td>30-day analytics aggregation</td>
      <td>&lt; 2 seconds</td>
    </tr>
    <tr>
      <td>Performance</td>
      <td>Dashboard first meaningful paint</td>
      <td>&lt; 2 seconds</td>
    </tr>
    <tr>
      <td>Scalability</td>
      <td>Concurrent API keys</td>
      <td>1,000+</td>
    </tr>
    <tr>
      <td>Security</td>
      <td>Token encryption</td>
      <td>AES-256 at rest</td>
    </tr>
    <tr>
      <td>Security</td>
      <td>API key storage</td>
      <td>bcrypt hashed, prefix indexed</td>
    </tr>
    <tr>
      <td>Security</td>
      <td>JWT signing</td>
      <td>HS256, 32+ char secret</td>
    </tr>
    <tr>
      <td>Reliability</td>
      <td>Redis failure behavior</td>
      <td>Allow requests, skip cache, log warning</td>
    </tr>
    <tr>
      <td>Observability</td>
      <td>Logging</td>
      <td>Pino JSON + X-Request-ID</td>
    </tr>
    <tr>
      <td>Observability</td>
      <td>Health check</td>
      <td>GET /health (DB + Redis + uptime)</td>
    </tr>
    <tr>
      <td>Testing</td>
      <td>Coverage</td>
      <td>&gt; 80% services and routes</td>
    </tr>
    <tr>
      <td>Documentation</td>
      <td>API docs</td>
      <td>OpenAPI 3.0 + GraphQL Playground</td>
    </tr>
  </tbody>
</table>


---

## 9. External Dependencies & Constraints

### 9.1 Instagram Graph API
- Requires Business/Creator account + Facebook Page linkage.
- Long-lived token workflow (60 days) with refresh endpoint.
- Rate limit ~200 calls/hour/token.
- Production apps may require Meta App Review for insights permissions.

### 9.2 LinkedIn API
- Requires developer app + verification.
- Token generator supports development quickly; production uses OAuth code flow.
- Some analytics capabilities may require product approvals/partner access.

---

## 10. Roadmap (Phased Delivery)

<table>
  <thead>
    <tr>
      <th>Phase</th>
      <th>Name</th>
      <th>Timeline</th>
      <th>Key Deliverables</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Foundation + Analytics Overview</td>
      <td>Week 1</td>
      <td>Monorepo, models, seed data, overview REST+GraphQL, dashboard</td>
    </tr>
    <tr>
      <td>2</td>
      <td>Channel Deep Dive + Comparison</td>
      <td>Week 2</td>
      <td>Channel CRUD, per-channel analytics, comparison, detail page</td>
    </tr>
    <tr>
      <td>3</td>
      <td>AI Strategist + API Keys + Auth</td>
      <td>Week 3</td>
      <td>Content brief, API keys, auth middleware, rate limiter</td>
    </tr>
    <tr>
      <td>4</td>
      <td>Connectors + Background Jobs</td>
      <td>Week 4</td>
      <td>IG+LI connectors, BullMQ sync jobs, OAuth callbacks</td>
    </tr>
    <tr>
      <td>5</td>
      <td>Testing + Docs + Polish</td>
      <td>Week 5</td>
      <td>80% coverage, OpenAPI spec, CI/CD, responsive UI</td>
    </tr>
  </tbody>
</table>


---

## 11. Risks and Mitigations

<table>
  <thead>
    <tr>
      <th>Risk</th>
      <th>Probability</th>
      <th>Impact</th>
      <th>Mitigation</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Instagram rate limit hit during sync</td>
      <td>Medium</td>
      <td>High</td>
      <td>Queue with backoff, batch sync, aggressive caching</td>
    </tr>
    <tr>
      <td>LinkedIn restricts post analytics to partners</td>
      <td>Medium</td>
      <td>High</td>
      <td>Use open permissions, mock analytics for demo, document requirements</td>
    </tr>
    <tr>
      <td>Token expiry causes stale data</td>
      <td>High</td>
      <td>Medium</td>
      <td>Daily refresh job, alert on failure, show “Last synced”</td>
    </tr>
    <tr>
      <td>Meta App Review delays</td>
      <td>Medium</td>
      <td>Medium</td>
      <td>Demo in dev mode, document review process</td>
    </tr>
    <tr>
      <td>Metric normalization discrepancies</td>
      <td>Low</td>
      <td>High</td>
      <td>Unit tests validate formulas, document definitions</td>
    </tr>
    <tr>
      <td>Redis unavailability</td>
      <td>Low</td>
      <td>Medium</td>
      <td>Graceful degradation: skip cache, allow requests, log</td>
    </tr>
  </tbody>
</table>


---

## 12. Glossary

<table>
  <thead>
    <tr>
      <th>Term</th>
      <th>Definition</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Engagement Rate</td>
      <td>(likes + comments + shares + saves + clicks) / impressions</td>
    </tr>
    <tr>
      <td>Connector</td>
      <td>Platform API module implementing fetch and refresh logic</td>
    </tr>
    <tr>
      <td>Content Brief</td>
      <td>Deterministic strategist output computed from analytics aggregation</td>
    </tr>
    <tr>
      <td>Snapshot</td>
      <td>Pre-aggregated analytics for a period (daily/weekly/monthly)</td>
    </tr>
    <tr>
      <td>Token Bucket</td>
      <td>Rate limit algorithm: tokens refill; exhausted returns 429</td>
    </tr>
    <tr>
      <td>Cursor Pagination</td>
      <td>Pagination using MongoDB _id; stable with inserts</td>
    </tr>
  </tbody>
</table>


---

## 13. Appendix: Requirement Priorities

- **P0 (Must Have):** FR-100, FR-200, FR-600, FR-700
- **P1 (Should Have):** FR-300, FR-400, FR-500  
