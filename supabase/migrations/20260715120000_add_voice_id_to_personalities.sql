-- Add voice_id to personalities so each personality has its own voice
ALTER TABLE public.personalities ADD COLUMN IF NOT EXISTS voice_id TEXT DEFAULT 'Zephyr';

-- Backfill existing personalities with default voice
UPDATE public.personalities SET voice_id = 'Zephyr' WHERE voice_id IS NULL OR voice_id = '';
