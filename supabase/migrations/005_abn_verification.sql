-- Add ABN verification fields to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS abn text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS abn_status text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS gst_registered boolean DEFAULT false;
