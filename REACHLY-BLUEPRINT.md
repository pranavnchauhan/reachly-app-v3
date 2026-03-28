# Reachly V3 — Product Blueprint

**Last updated:** 2026-03-28
**App URL:** https://app.reachly.com.au
**Repo:** github.com/pranavnchauhan/reachly-app-v3
**Status:** Production (Beta — onboarding first clients)

---

## 1. Vision & Strategy

### What Reachly Does
Reachly is a **signal-based B2B lead generation platform** for Australian businesses. Unlike traditional lead gen tools that spray cold lists, Reachly monitors real-time news and business events to find companies showing **buying signals** — then delivers verified, actionable leads with decision-maker contacts and personalised outreach strategies.

### Why It Exists
Cold outreach is broken. Response rates are <1%. Reachly flips the model:
1. Find companies with a **real, recent reason** to buy (the signal)
2. Identify the **right decision-maker** (not a generic contact)
3. Give the salesperson **context** (strategies, talking points, email templates)
4. Only charge for **verified, useful leads** (0% bounce guarantee)

### Business Model
- **Credit-based SaaS** — clients buy credit packs, spend 1 credit to reveal a lead's contact details
- **Admin-operated** — Pranav (KD) configures niches, runs pipelines, validates leads. Clients consume.
- **Three tiers:**

| Pack | Credits | Price (AUD) | Validity | Per Lead |
|------|---------|-------------|----------|----------|
| Pilot | 10 | $999 | 4 months | $99.90 |
| Growth | 20 | $1,799 | 9 months | $89.95 |
| Scale | 50 | $3,999 | 14 months | $79.98 |

### Target Market
- Australian B2B service companies (consulting, IT, logistics, manufacturing)
- 2-50 person sales teams
- Deal sizes $10K-$500K+
- Currently selling via KD Agency's client network

---

## 2. Architecture

### Tech Stack
```
Frontend:    Next.js 16 (App Router, Server Components, React 19)
Backend:     Next.js API Routes (serverless on Vercel Pro)
Database:    Supabase (PostgreSQL + Auth + Storage + RLS)
Payments:    Stripe Checkout + Webhooks
Email:       SendGrid (transactional emails)
Deployment:  Vercel Pro (auto-deploy from main branch)
Domain:      app.reachly.com.au
```

### External APIs (Pipeline)
```
Perplexity Sonar  — Signal discovery (news search)
Apollo.io         — Contact enrichment (people/match for email, api_search for candidates)
Claude API        — Deep research (company analysis, strategies, email generation)
ABR API           — ABN lookup for Australian business validation
```

### System Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL (Pro)                             │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐     │
│  │  Next.js     │  │  API Routes  │  │  Cron Jobs         │     │
│  │  App Router  │  │  /api/*      │  │  (5 scheduled)     │     │
│  │  (SSR + SC)  │  │              │  │                    │     │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘     │
│         │                 │                    │                 │
└─────────┼─────────────────┼────────────────────┼─────────────────┘
          │                 │                    │
          ▼                 ▼                    ▼
┌─────────────────┐  ┌──────────────┐  ┌────────────────────┐
│  Supabase       │  │  External    │  │  SendGrid          │
│  - PostgreSQL   │  │  APIs        │  │  (7 email triggers) │
│  - Auth         │  │  - Perplexity│  │                    │
│  - Storage      │  │  - Apollo    │  └────────────────────┘
│  - RLS          │  │  - Claude    │
│                 │  │  - ABR       │  ┌────────────────────┐
│                 │  │  - Stripe    │  │  Stripe             │
│                 │  │              │  │  (Checkout +        │
│                 │  │              │  │   Webhooks)         │
└─────────────────┘  └──────────────┘  └────────────────────┘
```

---

## 3. Pipeline Architecture (HOT LEADS ONLY)

The pipeline is the core engine. It runs weekly via cron and on-demand from admin.

### Pipeline Flow
```
┌──────────────────────────────────────────────────────────────────────┐
│                        PIPELINE EXECUTION                            │
│                                                                      │
│  Step 1: SIGNAL DISCOVERY (Perplexity)                               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ For each enabled signal (up to 5, in parallel):                │  │
│  │ → Search Australian news from last 60 days                     │  │
│  │ → Extract: company, evidence, source URL, confidence           │  │
│  │ → Entity filter: block universities, govt, ASX200              │  │
│  │ → Cross-run dedup: skip companies found in last 90 days        │  │
│  │ → Source verification: fetch URL, confirm company + evidence   │  │
│  │ → ONLY companies with verified source URLs survive (hot only)  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  Step 2: CONTACT ENRICHMENT (Apollo)                                 │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ For each hot company (batches of 5):                           │  │
│  │ → api_search: find up to 10 senior candidates (FREE)           │  │
│  │ → Title matching: score candidates against niche target_titles │  │
│  │   - Exact match: 100pts                                        │  │
│  │   - Contains target: 80pts                                     │  │
│  │   - C-suite/Director: 50pts                                    │  │
│  │   - Manager: 30pts                                             │  │
│  │   - Penalty: artist/technician/intern: -40pts                  │  │
│  │ → people/match: enrich best candidate with email (PAID CREDIT) │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  Step 3: DEEP RESEARCH (Claude)                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Top 5 leads (in parallel):                                     │  │
│  │ → Company analysis + contact summary                           │  │
│  │ → 3 approach strategies with talking points                    │  │
│  │ → 3 personalised email templates                               │  │
│  │ → Justification paragraph ("Why This Lead")                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  Step 4: SAVE TO DATABASE                                            │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ → Insert leads with status = "discovered"                      │  │
│  │ → Batch ID for grouping                                        │  │
│  │ → Leads land in admin validation queue (unassigned)            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### What Was Removed
- **Apollo keyword fallback** — used to fill to 20 leads with cold database matches. Deleted entirely. Cold leads wasted credits, had no signal, and destroyed trust. 100% hot now.
- **Employee size filter in Perplexity** — news articles don't reliably report employee counts. Filter was killing all results. Removed from prompt, kept in niche template config for future Apollo filtering.

---

## 4. Lead Lifecycle

```
                ADMIN SIDE                          │           CLIENT SIDE
                                                    │
  ┌──────────┐     ┌──────────┐     ┌──────────┐   │   ┌──────────┐     ┌──────────┐
  │DISCOVERED│────▶│VALIDATED │────▶│PUBLISHED │───┼──▶│ REVEALED │────▶│CONTACTED │
  │          │     │          │     │ to Client│   │   │ (1 credit)│     │          │
  └──────────┘     └──────────┘     └──────────┘   │   └──────────┘     └─────┬─────┘
       │                │                           │                         │
  Pipeline          Admin reviews:            Smart assign              Client works lead:
  discovers      - Signal valid?             to client with             Meeting → Proposal
  from news      - Contact right?            recommendations            → Won / Lost / Parked
                 - Verify button                                              │
                                                                        ┌─────▼─────┐
                                                                        │  DISPUTED  │
                                                                        │ (optional) │
                                                                        └──────┬─────┘
                                                                               │
                                                                        ┌──────▼─────┐
                                                                        │  REFUNDED  │
                                                                        │ (1 credit) │
                                                                        └────────────┘
```

### Client Disposition Pipeline
```
Revealed → Contacted → Meeting Booked → Proposal Sent → Won ($) / Lost / Parked
```

Each transition is tracked with timestamps. Deal value captured at Won/Proposal stage.

---

## 5. Validation & Smart Distribution (TO BUILD)

### Current State
- Leads are tied to a `client_niche_id` at pipeline time
- Admin validates and publishes — no choice of which client
- No audit trail of what was changed during validation

### Target Architecture

#### 5a. Unassigned Lead Pool
- Pipeline stores leads with `niche_template_id` (master niche), `client_niche_id = null`
- Leads land in a shared validation queue, grouped by master niche
- Schema change: add `niche_template_id` to leads table, make `client_niche_id` nullable

#### 5b. Smart Client Recommendation
When admin validates a lead, the system shows:
```
┌─────────────────────────────────────────────────────────────────┐
│  CSBP — Supply Chain Disruption (Long Lead Times signal)        │
│                                                                 │
│  Matching clients for "Operational Transformation" niche:       │
│  ┌──────────────────┬──────────┬───────────┬──────────────────┐ │
│  │ Client           │ Assigned │ Credits   │ Recommendation   │ │
│  ├──────────────────┼──────────┼───────────┼──────────────────┤ │
│  │ Winston Gray     │ 0 leads  │ 10 avail  │ ★ RECOMMENDED   │ │
│  │ Jasmine Test     │ 3 leads  │ 7 avail   │ —               │ │
│  │ Another Client   │ 5 leads  │ 0 avail   │ NO CREDITS      │ │
│  └──────────────────┴──────────┴───────────┴──────────────────┘ │
│                                                                 │
│  [Verify Contact]  [Assign to Winston Gray]  [Reject Lead]     │
└─────────────────────────────────────────────────────────────────┘
```

**Distribution logic:**
- Show all clients subscribed to this master niche
- Sort by: fewest assigned leads first, then by available credits
- Grey out clients with 0 credits
- Same company CAN go to multiple clients if different niches (different angle)
- Admin makes final call — system recommends, doesn't auto-assign

#### 5c. Verify Contact Button
One-click re-verification:
- Hits Apollo api_search for the company → shows top 5 candidates with titles
- Admin picks the right one → system enriches via people/match → updates lead
- Original contact stored for audit trail comparison

#### 5d. Validation Audit Trail
Every lead stores `validation_changes` JSON:
```json
{
  "validated_by": "admin_user_id",
  "validated_at": "2026-03-28T10:00:00Z",
  "changes": [
    {
      "field": "contact_name",
      "from": "Shannon McCann",
      "to": "John Backhouse"
    },
    {
      "field": "contact_title",
      "from": "Owner / Artist, Process Technician",
      "to": "Strategic Projects Manager"
    }
  ],
  "rejection_reason": null
}
```

#### 5e. Validation Insights (Admin Dashboard + Weekly Report)
```
VALIDATION INSIGHTS (rolling 4 weeks)
────────────────────────────────────
Leads discovered:     47
Leads validated:      31  (66%)
Leads rejected:       16  (34%)

Contact changed:      24 of 31  (77%)
Signal edited:         3 of 31  (10%)
Source URL replaced:   2 of 31  (6%)

Top rejection reasons:
- Wrong industry (8)
- Company too large (4)
- Duplicate (3)

Top contact change patterns:
- "Technician" → "Director/Manager"  (9x)
- "Co-Founder" → "CFO/COO"          (7x)
```

This feeds back into pipeline improvement — if 80% of contacts get changed, we know Apollo title-matching needs a specific fix.

---

## 6. Lead Expiry & Urgency System (TO BUILD)

### Rules
- **14-day countdown** starts when a lead is published to a client
- Clicking "Contacted" stops the timer — lead is theirs permanently
- Unrevealed leads at day 14 → status = "expired" (greyed out, re-assignable)
- Expired leads are NOT deleted — admin can re-assign to another client

### Notification Schedule
| Day | Action |
|-----|--------|
| 0 | Lead published → "New leads ready" email |
| 7 | "3 hot leads going cold in 7 days" email |
| 12 | "Final warning: 2 leads expire in 2 days" email |
| 14 | Lead expires → greyed out, can't reveal |

### Client UX
- Lead cards show countdown badge: "Expires in 5d"
- Expired leads show "Expired" badge, reveal button disabled
- "Contacted" button prominently displayed — stops the clock

---

## 7. Client Journey

### Onboarding (Admin-Driven)
```
1. Admin creates company (ABN lookup + website scrape for auto-fill)
2. Admin creates user account (email + temp password)
3. System sends branded welcome email via SendGrid (magic link)
4. Admin assigns niche(s) to client
5. Admin gives 1 free credit for demo
6. Client logs in → sees dashboard → explores sample lead
```

### Ongoing Usage
```
Weekly:
  → Cron runs pipeline (Sunday 6am AEST)
  → Admin validates + assigns leads (Mon/Tue)
  → Client gets "New leads" email
  → Client reveals leads (spends credits)
  → Client works leads (contacted → meeting → proposal → won)

Monthly:
  → Client buys more credits via Stripe
  → Admin reviews validation insights
  → Admin tunes niche signals based on patterns
```

### Client Dashboard Features
- **Stats:** New Leads, Revealed, Credits (with expiry), Active Niches
- **Lead List:** Cards with signal badges, reveal/lock status, search/filter
- **Lead Detail Modal:** 5 tabs (Overview, Signals, Strategies, Emails, Activity)
- **Disposition Tracking:** Pipeline status, follow-up dates, deal value, star rating
- **Activity Timeline:** Notes, call logs, email sent, meeting booked
- **Credits Page:** Pack details, expiry countdown, transaction history, buy more
- **Disputes:** File structured disputes with per-channel evidence + screenshots
- **Settings:** Read-only niche view (signals, titles, geography), profile info

### What Clients CAN'T Do
- Register themselves (admin onboards)
- Change niche configuration (request via admin)
- See other clients' leads
- Access admin panel

---

## 8. Credit Lifecycle

```
Purchase (Stripe) ──▶ Credit Pack created (with expiry)
                           │
                     ┌─────▼──────┐
                     │ Available   │◀── Rollover from old pack
                     │ Credits     │◀── Dispute refund (+1)
                     └─────┬──────┘
                           │
                     Reveal Lead (-1)
                           │
                     ┌─────▼──────┐
                     │ Used        │
                     │ Credits     │
                     └─────┬──────┘
                           │
                     Pack expires → remaining credits lost
                     (unless new pack purchased → rollover)
```

### Rules
- Credits deducted from oldest non-expired pack first
- Expired packs skipped (soft prompt: "credits expired, buy more")
- New purchase rolls over remaining credits from old packs
- Dispute approval refunds 1 credit
- Credit low warning email at ≤2 remaining
- Expiry reminder email at ≤14 days before expiry

---

## 9. Database Schema

### Core Tables
| Table | Purpose |
|-------|---------|
| `profiles` | Users (extends auth.users) — admin, staff, client roles |
| `companies` | Client companies (ABN, website, phone, address) |
| `niche_templates` | Master niches (signals, industries, keywords, target_titles) |
| `client_niches` | Client subscriptions to niches (enabled signals, geography) |
| `leads` | All leads with full data (company, contact, signals, strategies, emails) |
| `lead_notes` | Activity timeline entries (notes, calls, emails, meetings) |
| `pipeline_runs` | Pipeline execution records (status, progress, results) |
| `credit_packs` | Credit balances with expiry dates |
| `credit_transactions` | Purchase, debit, refund log |
| `disputes` | Lead disputes with structured evidence per channel |
| `signal_requests` | Client requests for custom signals (pending/approved/rejected) |

### Schema Changes Needed (for validation + distribution)
```sql
-- Make client_niche_id nullable, add niche_template_id
ALTER TABLE leads ADD COLUMN niche_template_id uuid REFERENCES niche_templates(id);
ALTER TABLE leads ALTER COLUMN client_niche_id DROP NOT NULL;

-- Validation audit trail
ALTER TABLE leads ADD COLUMN validation_changes jsonb;

-- Lead expiry
ALTER TABLE leads ADD COLUMN expires_at timestamptz;
ALTER TABLE leads ADD COLUMN expired_at timestamptz;

-- Add 'expired' to lead_status enum
ALTER TYPE lead_status ADD VALUE 'expired';
```

---

## 10. API Routes

### Pipeline
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/pipeline/run` | POST | Kick off pipeline (async via `after()`) |
| `/api/pipeline/run` | GET | Cron trigger |
| `/api/pipeline/status/[id]` | GET | Poll pipeline progress |

### Admin
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/create-client` | POST | Create client user |
| `/api/admin/onboard-client` | POST | Send welcome email (magic link) |
| `/api/admin/create-company` | POST | Create company record |
| `/api/admin/abn-lookup` | GET | ABN search (by name or ABN) |
| `/api/admin/scrape-website` | GET | Extract phone, email, address from website |
| `/api/admin/assign-niche` | POST/PATCH/DELETE | Manage client niche assignments |
| `/api/admin/add-credits` | POST | Issue credits to client |
| `/api/admin/update-lead` | POST | Validate/publish/edit leads |
| `/api/admin/update-niche-template` | PATCH | Edit master niche template |
| `/api/admin/resolve-dispute` | POST | Approve (refund) or reject dispute |
| `/api/admin/users` | GET/POST | List and manage users |
| `/api/admin/list-companies` | GET | List all companies |
| `/api/admin/list-templates` | GET | List niche templates |
| `/api/admin/delete-leads` | DELETE | Bulk delete leads |
| `/api/admin/orphaned-data` | GET/DELETE | Find and clean orphaned records |
| `/api/admin/account-lifecycle` | POST | Delete user account |

### Client
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/leads/reveal` | POST | Reveal contact (spend 1 credit) |
| `/api/leads/disposition` | PATCH | Update pipeline status, rating, follow-up |
| `/api/leads/notes` | GET/POST | Activity timeline |
| `/api/disputes` | GET/POST | File disputes with evidence |

### Payments
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/stripe/checkout` | POST | Create Stripe checkout session |
| `/api/stripe/webhook` | POST | Handle payment success, rollover credits |

### Cron Jobs (Vercel Scheduled)
| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/weekly-pipeline` | Sunday 6am AEST | Run pipeline for all active niches |
| `/api/pipeline/run` | Sunday 2am AEST | Alternative pipeline trigger |
| `/api/cron/weekly-digest` | Sunday 8am AEST | Client weekly summary email |
| `/api/cron/expiry-reminder` | Monday 7am AEST | Credit expiry warning email |
| `/api/cron/purge-archived` | Sunday midnight AEST | Clean up archived leads |

---

## 11. Email Notifications

| Trigger | Recipient | Template |
|---------|-----------|----------|
| New leads published | Client | "X new leads ready to reveal" |
| Lead revealed | Client | Contact details confirmation |
| Credit low (≤2) | Client | "Only X credits remaining" + buy CTA |
| Credit expiring (≤14d) | Client | "Credits expire in X days" + top up CTA |
| Weekly digest | All clients | New leads, reveals, credits, expiry countdown |
| Dispute filed | Admin | Evidence table + "Review in Admin Panel" link |
| Dispute resolved | Client | Approved (credit refunded) or rejected (with notes) |
| Weekly pipeline report | Admin | Per-client hot lead breakdown + validation link |
| Lead expiry warning (TO BUILD) | Client | "X leads going cold" at day 7 and day 12 |

---

## 12. App Pages

### Admin Pages (`/admin/*`)
| Page | Purpose |
|------|---------|
| `/admin` | Command Centre — stats, recent leads, quick nav, dispute banner |
| `/admin/leads` | Lead validation queue — validate, publish with client recommendations |
| `/admin/clients` | Client list with lead counts |
| `/admin/clients/[id]` | Client detail — niches, credits, assigned leads |
| `/admin/clients/new` | Onboard new client (ABN + website scrape) |
| `/admin/niches` | Master niche template list |
| `/admin/niches/[id]` | Edit niche template (signals, titles, keywords) |
| `/admin/niches/new` | Create new niche template |
| `/admin/disputes` | Review disputes with evidence, approve/reject |
| `/admin/users` | User management |
| `/admin/orphaned` | Find orphaned data (niches without clients, etc.) |

### Client Pages (`/dashboard/*`)
| Page | Purpose |
|------|---------|
| `/dashboard` | Welcome + stats + lead alerts + follow-ups + conversion funnel |
| `/dashboard/leads` | Lead cards with reveal, search, filter, detail modal |
| `/dashboard/credits` | Credit packs, transaction history, expiry warnings |
| `/dashboard/buy-credits` | 3-tier pricing page → Stripe checkout |
| `/dashboard/disputes` | File + track disputes |
| `/dashboard/settings` | Profile, niche info (read-only), support |

### Auth Pages (`/auth/*`)
| Page | Purpose |
|------|---------|
| `/auth/login` | Email + password login |
| `/auth/reset-password` | Password reset form |
| `/auth` | Token handler (processes magic links, password reset tokens) |
| `/auth/callback` | OAuth callback (not used currently) |
| `/auth/signup` | Disabled (admin-only onboarding) |

---

## 13. File Structure

```
src/
├── app/
│   ├── admin/              ← Admin panel (SSR pages)
│   ├── api/                ← API routes (serverless functions)
│   │   ├── admin/          ← Admin-only endpoints
│   │   ├── cron/           ← Scheduled jobs
│   │   ├── leads/          ← Client lead operations
│   │   ├── pipeline/       ← Pipeline execution + polling
│   │   ├── stripe/         ← Payments
│   │   └── disputes/       ← Client disputes
│   ├── auth/               ← Auth pages + token handler
│   └── dashboard/          ← Client dashboard (SSR + client components)
│
├── components/
│   ├── admin/              ← Admin UI components
│   │   ├── pipeline-trigger.tsx     ← Run pipeline + live progress
│   │   ├── lead-validation-list.tsx ← Validate + publish leads
│   │   ├── assign-niche.tsx         ← Manage client niche assignments
│   │   ├── add-credits.tsx          ← Issue credits
│   │   └── client-actions.tsx       ← Client management actions
│   ├── client/
│   │   └── leads-list.tsx           ← Lead cards + 5-tab detail modal
│   ├── layout/
│   │   └── sidebar.tsx              ← Role-based navigation
│   └── ui/
│       └── confirm-modal.tsx        ← Reusable confirmation dialog
│
├── lib/
│   ├── pipeline/                    ← Pipeline engine
│   │   ├── discover-signals.ts      ← Perplexity signal discovery
│   │   ├── enrich-contacts.ts       ← Apollo contact enrichment
│   │   ├── deep-research.ts         ← Claude AI research
│   │   ├── find-signals.ts          ← Signal matching types
│   │   ├── source-companies.ts      ← Company sourcing utilities
│   │   └── safe-fetch.ts            ← 15s timeout wrapper
│   ├── supabase/
│   │   ├── admin.ts                 ← Service role client (bypasses RLS)
│   │   ├── client.ts                ← Browser client (singleton, cookies)
│   │   ├── server.ts                ← Server component client
│   │   └── middleware.ts            ← Auth middleware helper
│   ├── auth.ts                      ← getUser() with React cache()
│   ├── email.ts                     ← SendGrid templates + sender
│   └── stripe.ts                    ← Stripe client + credit pack definitions
│
├── middleware.ts                     ← Auth guard + role routing
└── types/
    └── database.ts                  ← TypeScript types for all entities
```

---

## 14. Security Model

### Authentication
- Supabase Auth (email/password, magic links)
- Implicit flow with `@supabase/ssr` (cookie-based sessions)
- Singleton browser client to prevent multiple GoTrueClient instances
- `admin.generateLink()` for server-initiated emails (avoids PKCE issues)
- Password minimum: 12 characters

### Authorization
- **3 roles:** admin, staff, client
- Middleware routes: `/admin/*` → admin/staff only, `/dashboard/*` → client only
- RLS on all tables — clients only see their own data
- Admin API routes use `createAdminClient()` (service role, bypasses RLS)
- Client API routes verify auth token + role before proceeding

### Data Isolation
- Clients cannot see other clients' leads, credits, or disputes
- Company-level credit packs (shared across users in same company)
- Admin panel is a completely separate layout with separate navigation

---

## 15. Implementation Roadmap

### Completed (v3.0 — v3.4)
- [x] Core app: auth, admin panel, client dashboard
- [x] Pipeline engine: Perplexity + Apollo + Claude
- [x] Hot-only pipeline: source verification, entity filter, title matching
- [x] Credit lifecycle: purchase, expiry, rollover, soft prompts
- [x] Lead detail modal: 5 tabs, disposition tracking, activity timeline
- [x] Dispute system: structured per-channel evidence, screenshot upload
- [x] Email notifications: 7 triggers via SendGrid
- [x] Cron jobs: weekly pipeline, weekly digest, expiry reminders, purge
- [x] Client onboarding: ABN lookup, website scrape, magic link welcome email
- [x] Master niche editor: signals, industries, keywords, target titles
- [x] Client niche management: assign, toggle signals, edit geography
- [x] Admin client detail page with lead visibility
- [x] Cross-run deduplication (90-day window)
- [x] Pipeline performance: parallel Perplexity/research, 15s timeouts, after()

### Next Sprint: Validation & Distribution (v3.5)
- [ ] Schema migration: nullable client_niche_id, add niche_template_id
- [ ] Pipeline writes leads as unassigned (niche_template_id only)
- [ ] Validation queue grouped by master niche
- [ ] Smart client recommendation panel (leads assigned, credits available)
- [ ] "Verify Contact" button (Apollo re-search, pick from candidates)
- [ ] Validation audit trail (before/after JSON on every lead)
- [ ] Validation insights on admin dashboard (charts + patterns)
- [ ] Weekly admin report includes validation insights section
- [ ] Client niche settings: read-only view (signals, titles, geography)

### Following Sprint: Lead Expiry & Urgency (v3.6)
- [ ] 14-day expiry countdown from publish date
- [ ] "Contacted" button stops expiry timer
- [ ] Expired lead status (greyed out, can't reveal, re-assignable)
- [ ] Day 7 + Day 12 reminder emails
- [ ] Expiry cron job (daily, moves expired leads)
- [ ] Expiry countdown badges on client lead cards

### Future Sprints
- [ ] Admin dashboard analytics (conversion rates, revenue pipeline, client health)
- [ ] Bulk validation actions (validate + assign multiple leads at once)
- [ ] Client self-serve signal request form
- [ ] Webhook for new lead notifications (Slack, Teams, etc.)
- [ ] API access for enterprise clients
- [ ] White-label capability

---

## 16. Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Pipeline APIs
PERPLEXITY_API_KEY=
APOLLO_API_KEY=
ANTHROPIC_API_KEY=

# ABN Lookup
ABR_GUID=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# SendGrid
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=

# App
NEXT_PUBLIC_APP_URL=https://app.reachly.com.au
ADMIN_EMAIL=
CRON_SECRET=
```

---

## 17. Key Decisions & Why

| Decision | Why |
|----------|-----|
| Hot leads only (no Apollo fallback) | Cold leads waste credits, have no signal, destroy client trust |
| Admin-operated (no self-serve registration) | Quality control — niche configuration is part of the service |
| Credit-based (not subscription) | Aligns cost with value — pay per lead, not per month |
| 14-day lead expiry | Creates urgency, prevents lead hoarding, enables redistribution |
| Validation audit trail | Data-driven pipeline improvement — track what the AI gets wrong |
| Same company to multiple clients OK | Different niches = different angles. Like needing a builder AND an architect |
| Client can't edit niche signals | They don't understand signals. Admin configures based on ICP. That's the service. |
| Perplexity for discovery (not Apollo search) | News signals are the differentiator. Apollo search returns generic lists like any tool |
| Title-matching with scoring | Prevents wrong contacts (artists, technicians) reaching clients |
| Source URL + evidence double-verification | Catches Perplexity hallucinations before they reach validation queue |
