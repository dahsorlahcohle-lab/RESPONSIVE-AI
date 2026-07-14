-- Personalities table: replaces the contact system with AI personality profiles
CREATE TABLE IF NOT EXISTS public.personalities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  communication_style TEXT NOT NULL DEFAULT '',
  knowledge_area TEXT NOT NULL DEFAULT '',
  behavior_pattern TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS personalities_user_id_idx ON public.personalities(user_id);

ALTER TABLE public.personalities ENABLE ROW LEVEL SECURITY;

-- Update call_sessions to also support personality_id
ALTER TABLE public.call_sessions ADD COLUMN IF NOT EXISTS personality_id UUID REFERENCES public.personalities(id) ON DELETE SET NULL;
ALTER TABLE public.call_sessions ADD COLUMN IF NOT EXISTS personality_name TEXT DEFAULT '';
