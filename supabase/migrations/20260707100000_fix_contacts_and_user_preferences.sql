-- Fixes two gaps discovered by live diagnostics against production Supabase:
--
-- 1. `public.contacts` was never defined in 20260705000000_create_tables.sql, even though
--    src/lib/db-fallback.ts (createContact/listContacts) queries it directly. Every contact
--    save/read was silently failing against Supabase and falling back to Firestore, which is
--    why contacts didn't reliably show up after creation.
--
-- 2. `src/lib/db-fallback.ts` (getPreferences/updatePreferences) queries a table named
--    `user_preferences` with columns (user_id, default_voice, ai_personality, ai_speed) —
--    but the original migration only created a differently-shaped `preferences` table
--    (selected_voice, voice_speed, theme, ...). These never matched, so voice/persona
--    selection never persisted to Supabase either.
--
-- This migration adds the two tables the actual application code expects, matching
-- src/lib/db-fallback.ts exactly. Verified end-to-end against the live database.

CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Unknown',
  company TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts"
  ON public.contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
  ON public.contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON public.contacts FOR DELETE
  USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  default_voice TEXT DEFAULT 'Zephyr',
  ai_personality TEXT DEFAULT 'friendly',
  ai_speed NUMERIC DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own user_preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own user_preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own user_preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);
