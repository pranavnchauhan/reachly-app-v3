# Reachly V3 — Demo & Test Plan

**App URL:** https://app.reachly.com.au
**Admin account:** admin@reachly.com.au
**Test client account:** pranavnc@gmail.com (or any client account)

---

## A) Admin Flow

### 1. Login
- [ ] Go to app.reachly.com.au → login page appears
- [ ] Login with admin credentials → redirects to `/admin` (Command Centre)
- [ ] Skeleton loader shows briefly → dashboard loads with stats

### 2. Admin Dashboard
- [ ] Quick nav shows: Clients, Niche Templates, To Validate, Active Niches, Published
- [ ] Lead Pipeline section shows: Total, Discovered, Validated, Published, Revealed, Approval %
- [ ] Recent Leads list shows latest leads with HOT/COLD badges
- [ ] Clients list shows onboarded clients
- [ ] If pending disputes exist → orange banner at top: "X disputes pending review"

### 3. Niche Templates
- [ ] Sidebar → Niche Templates → list of templates appears
- [ ] Click a template → see signals, industries, keywords, target titles
- [ ] Create new template → fills in name, description, signals, geography

### 4. Run Pipeline
- [ ] Dashboard → Run Pipeline section → select a niche → click "Run Now"
- [ ] UI shows live progress: "Searching news for buying signals..." → "Finding contacts..." → "AI-researching..."
- [ ] Pipeline completes → shows results (X hot + Y cold → Z enriched → N leads)
- [ ] Page reloads with new discovered leads

### 5. Lead Validation
- [ ] Sidebar → Lead Validation → see discovered leads
- [ ] Review lead details → validate (mark as validated)
- [ ] Publish lead → lead becomes visible to client
- [ ] **Email check:** client should receive "New leads ready to reveal" email

### 6. Client Management
- [ ] Sidebar → Clients → see client list with company names
- [ ] Click a client → see detail: niches, credits, leads
- [ ] Add credits → specify amount and validity → credits appear on client dashboard
- [ ] Onboard new client → create user, assign niche, send welcome email

### 7. Dispute Management
- [ ] Sidebar → Disputes → see all disputes with filter tabs (Pending/Approved/Rejected/All)
- [ ] Click "Pending" → see disputed leads with full evidence:
  - Company name and contact
  - Contact channels that were provided (email, phone, LinkedIn values)
  - Per-channel evidence: issue type, description, screenshot link
- [ ] Type admin notes → click "Approve & Refund 1 Credit"
  - [ ] Dispute status changes to Approved
  - [ ] 1 credit refunded (check client's credit balance)
  - [ ] Client receives "Dispute approved" email
- [ ] Test reject flow: type notes → click "Reject"
  - [ ] Status changes to Rejected
  - [ ] Client receives "Dispute reviewed" email with admin notes

### 8. Users
- [ ] Sidebar → Users → see all users with roles
- [ ] Create new user → send password reset email
- [ ] Reset password for existing user → they receive magic link

---

## B) Client Flow

### 1. Login & Password Reset
- [ ] Go to app.reachly.com.au → login page
- [ ] Click "Forgot password?" → enter email → receive reset link
- [ ] Click link in email → password reset form appears → set new password (12+ chars)
- [ ] Login with new password → redirects to `/dashboard`

### 2. Dashboard
- [ ] Welcome message with first name
- [ ] 4 stat cards: New Leads, Revealed, Credits (with expiry date), Active Niches
- [ ] Clicking any card navigates to the relevant page
- [ ] Active Niches section shows assigned niche tags
- [ ] **If leads available:** "X new leads are ready!" banner with "View Leads" button
- [ ] **If no credits:** "Get started with credits" banner with "Buy Credits" button
- [ ] **If follow-ups due:** yellow "Follow-ups Due" section with overdue leads
- [ ] **If leads have been worked:** Conversion funnel appears (Revealed → Contacted → Meeting → Proposal → Won)
- [ ] **If deals won:** Revenue total shows at bottom of funnel

### 3. My Leads — Reveal Flow
- [ ] Sidebar → My Leads → see published leads as cards
- [ ] Cards show: company name, industry, location, signal badges, "Contact hidden" lock icon
- [ ] HOT leads have red flame badge (signal from news)
- [ ] Click a lead card → modal opens with tabs

#### Lead Modal — Before Reveal
- [ ] **Overview tab:** company info (website, industry, size, location) + "Contact details are locked" message
- [ ] **Signals tab:** "Why This Lead" justification + buying signals with confidence % and source links
- [ ] Strategies & Emails tabs hidden (locked)
- [ ] "Reveal Contact (1 credit) — X remaining" button at top
- [ ] Click Reveal → contact info appears, credit deducted
- [ ] **Email check:** receive "Lead revealed: [Contact] at [Company]" email with contact details

#### Lead Modal — After Reveal (5 tabs)
- [ ] **Overview tab:**
  - Pipeline status buttons: Revealed / Contacted / Meeting Booked / Proposal Sent / Won / Lost / Parked
  - Click "Contacted" → saves immediately, badge updates
  - Star rating (1-5) → click stars → saves
  - Follow-up date → pick a date → saves, shows on dashboard
  - Deal value field (shows for Won/Proposal) → enter amount → saves
  - Contact section: email (clickable mailto), phone (clickable tel), LinkedIn (opens new tab)
  - Background summary of the contact person

- [ ] **Signals tab:**
  - "Why This Lead" paragraph
  - Each signal: name, confidence %, evidence text, source link

- [ ] **Strategies tab:**
  - 3 collapsible tiles (first one open by default)
  - Each has: strategy name, description, talking points
  - Click to expand/collapse

- [ ] **Emails tab:**
  - 3 collapsible email templates (first one open by default)
  - Subject line and body with {{company}} and {{contact_name}} auto-replaced
  - **"Send this email" button** → opens default mail app with to/subject/body pre-filled
  - **"Copy" button** → copies subject + body to clipboard

- [ ] **Activity tab:**
  - Quick log buttons: Contacted / Voicemail / Email Sent / Meeting (one click adds to timeline)
  - Free text note input → type → press Enter or click Add
  - Timeline shows all activity with icons and relative timestamps ("2h ago", "3d ago")

- [ ] **Footer:** Dispute link + LinkedIn Connect button + Email button

### 4. Credits
- [ ] Sidebar → Credits → see Available / Total Purchased / Used
- [ ] Available card shows earliest expiry date
- [ ] Credit packs listed with: total, remaining, progress bar, purchased date, expiry date
- [ ] Status badges: Active (green) / Expiring in Xd (yellow) / Expired (red) / Fully used (gray) / No expiry
- [ ] Transaction history table: date, type badge, amount, description
- [ ] "Buy Credits" button in header → goes to pricing page
- [ ] **If credits expiring within 14 days:** yellow warning banner with "Top up now" link
- [ ] **If credits expired:** red notice: "X credits expired — purchase to roll over"

### 5. Buy Credits
- [ ] 3 pricing tiers matching reachly.com.au:
  - The Pilot Pack: $999 / 10 credits / 4 months
  - The Growth Engine: $1,799 / 20 credits / 9 months (Most Popular badge)
  - The Scale Accelerator: $3,999 / 50 credits / 14 months
- [ ] Each card shows: features, validity period, "Get Started" button, "Preview Sample Lead"
- [ ] Rollover note at bottom: "Top up before expiry to roll over remaining balance"
- [ ] Click "Get Started" → redirects to Stripe checkout
- [ ] Complete payment → redirects back with "X credits purchased!" success message
- [ ] **Rollover test:** if existing credits remain, new pack should include rolled-over credits

### 6. Disputes
- [ ] Sidebar → Disputes → guarantee notice displayed at top
- [ ] "New Dispute" button → opens form
- [ ] Select a revealed lead from dropdown → form shows ALL contact channels provided
- [ ] For EACH channel (email/phone/LinkedIn):
  - Channel name + actual contact value shown
  - "What happened?" dropdown (Bounced / Wrong person / Doesn't exist / No response)
  - Description text field (required)
  - Screenshot upload (drag-drop or click)
  - Green checkmark appears when channel evidence is complete
  - "Required" badge shows until filled
- [ ] Submit button BLOCKED until all channels have issue + detail
- [ ] Submit → dispute filed → appears in list with "Pending" badge
- [ ] **Email check (admin):** receive email with formatted evidence table + "Review in Admin Panel" link
- [ ] After admin resolves:
  - Approved → "1 credit refunded" message, credit balance increases
  - Rejected → admin notes shown in the dispute card

### 7. Settings
- [ ] Profile: name, email, company, member since
- [ ] Account Summary: credits available, leads revealed, account type
- [ ] My Niches: niche name, description, geography, signals count, exclusions, status badge
- [ ] Support section: "Contact Support" button → mailto:info@reachly.com.au

### 8. Credit Low Warning
- [ ] Reveal leads until balance reaches 2 or below
- [ ] **Email check:** receive "Only X credits remaining" email with "Buy More Credits" CTA

---

## C) Email Notifications Checklist

| Trigger | Recipient | Subject | Test |
|---------|-----------|---------|------|
| New leads published | Client | "X new leads ready to reveal" | Publish a lead as admin |
| Lead revealed | Client | "Lead revealed: [Contact] at [Company]" | Reveal a lead as client |
| Credit low (≤2) | Client | "Only X credits remaining" | Reveal until balance ≤ 2 |
| Dispute filed | Admin | "Dispute filed: [Company] by [Client]" | File a dispute as client |
| Dispute resolved | Client | "Dispute approved/reviewed: [Company]" | Approve/reject as admin |
| Credit expiry (≤14 days) | Client | "X credits expiring in Y days" | Set expiry to <14 days, trigger cron |
| Weekly digest | All clients | "Your weekly Reachly summary" | Trigger: `curl -H "Authorization: Bearer CRON_SECRET" app.reachly.com.au/api/cron/weekly-digest` |

---

## D) Performance Checks

- [ ] Page navigation shows skeleton loader instantly (no blank screen)
- [ ] Dashboard loads within 1-2 seconds
- [ ] Lead modal opens instantly (client-side)
- [ ] Disposition changes save without page reload
- [ ] Activity notes appear immediately in timeline after adding

---

## E) Pre-Demo Checklist

1. Run pipeline to have fresh leads (admin → Run Pipeline)
2. Validate and publish at least 3 leads
3. Ensure test client has credits (add via admin if needed)
4. Clear browser localStorage before demo (prevents stale auth issues)
5. Test password reset flow once to confirm SendGrid is working
6. Have Stripe test card ready: `4242 4242 4242 4242` (any future expiry, any CVC)
