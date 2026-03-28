-- Sprint 3.5: Validation & Smart Distribution
-- Run this in Supabase SQL Editor

-- 1. Add niche_template_id to leads (for unassigned leads tied to master niche)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS niche_template_id uuid REFERENCES niche_templates(id);

-- 2. Make client_niche_id nullable (leads start unassigned)
ALTER TABLE leads ALTER COLUMN client_niche_id DROP NOT NULL;

-- 3. Add validation audit trail
ALTER TABLE leads ADD COLUMN IF NOT EXISTS validation_changes jsonb;

-- 4. Add lead expiry fields (for Sprint 3.6 but adding now to avoid another migration)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS expired_at timestamptz;

-- 5. Add 'expired' to lead_status enum
DO $$ BEGIN
  ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'expired';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Backfill niche_template_id for existing leads from their client_niche
UPDATE leads l
SET niche_template_id = cn.template_id
FROM client_niches cn
WHERE l.client_niche_id = cn.id
  AND l.niche_template_id IS NULL;

-- 7. Indexes for unassigned leads queries
CREATE INDEX IF NOT EXISTS idx_leads_template ON leads(niche_template_id);
CREATE INDEX IF NOT EXISTS idx_leads_unassigned ON leads(niche_template_id) WHERE client_niche_id IS NULL;
