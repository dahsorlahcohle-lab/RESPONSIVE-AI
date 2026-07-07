-- Fixes another live schema gap found by diagnostics against production Supabase:
--
-- src/lib/db-fallback.ts (createCallSession/updateCallSession/listCallSessions and
-- saveTranscriptMessages/listTranscriptMessages) queries tables `call_sessions` and
-- `transcript_messages` directly -- but neither was ever defined in the original
-- migration (which instead created a differently-shaped, unused `voice_sessions`
-- table with no contact_id column at all). Every call session + transcript save
-- was silently failing against Supabase and falling back to Firestore, which is
-- why "remember the last conversation with this contact" had nothing reliable to
-- read back from.
--
-- This migration adds the two tables the actual application code expects, matching
-- src/lib/db-fallback.ts exactly, including the contact_id link needed to look up
-- a contact's most recent call.

CREATE TABLE IF NOT EXISTS public.call_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  selected_voice TEXT DEFAULT 'Zephyr',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  duration_seconds INTEGER DEFAULT 0,
  ai_notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own call sessions"
  ON public.call_sessions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can create their own call sessions"
  ON public.call_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own call sessions"
  ON public.call_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_call_sessions_user_contact
  ON public.call_sessions (user_id, contact_id, created_at DESC);


CREATE TABLE IF NOT EXISTS public.transcript_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_session_id UUID NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL CHECK (speaker IN ('User', 'AI')),
  message TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.transcript_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transcripts for their own call sessions"
  ON public.transcript_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.call_sessions cs
      WHERE cs.id = call_session_id AND (cs.user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "Users can insert transcripts for their own call sessions"
  ON public.transcript_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.call_sessions cs
      WHERE cs.id = call_session_id AND cs.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_transcript_messages_call_session
  ON public.transcript_messages (call_session_id, timestamp ASC);
