-- Structured disputes — per-channel evidence
-- Run this in Supabase SQL Editor

-- Add structured evidence columns to disputes
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS channels_provided text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS channel_evidence jsonb DEFAULT '[]';

-- channel_evidence format:
-- [
--   { "channel": "email", "issue": "bounced", "detail": "Bounce-back received", "screenshot_url": "..." },
--   { "channel": "phone", "issue": "wrong_person", "detail": "Someone else answered", "screenshot_url": null },
--   { "channel": "linkedin", "issue": "doesnt_exist", "detail": "Profile returns 404", "screenshot_url": "..." }
-- ]

-- Create storage bucket for dispute evidence screenshots (run in Supabase Dashboard > Storage)
-- Bucket name: dispute-evidence
-- Public: false
-- File size limit: 5MB
-- Allowed MIME types: image/png, image/jpeg, image/webp, application/pdf
