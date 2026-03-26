-- Lead Disposition — tracks what happened after reveal
-- Run this in Supabase SQL Editor

-- Add disposition columns to leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS disposition text DEFAULT 'revealed',
  ADD COLUMN IF NOT EXISTS disposition_note text,
  ADD COLUMN IF NOT EXISTS follow_up_date date,
  ADD COLUMN IF NOT EXISTS deal_value numeric,
  ADD COLUMN IF NOT EXISTS lead_rating smallint,
  ADD COLUMN IF NOT EXISTS contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS won_at timestamptz,
  ADD COLUMN IF NOT EXISTS lost_at timestamptz;

-- Lead notes / activity log
CREATE TABLE lead_notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id),
  type text NOT NULL DEFAULT 'note', -- 'note', 'contacted', 'voicemail', 'email_sent', 'meeting', 'status_change'
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_notes_lead ON lead_notes(lead_id);
CREATE INDEX idx_lead_notes_client ON lead_notes(client_id);

-- RLS
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients manage own notes" ON lead_notes FOR ALL USING (client_id = auth.uid());
CREATE POLICY "Admins manage all notes" ON lead_notes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);
