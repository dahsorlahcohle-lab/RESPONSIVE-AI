import { getSupabaseAdmin } from "./supabase-admin";

// Supabase-only data runner (single-owner app; the Firestore fallback layer
// has been removed -- the live Supabase schema is complete and authoritative).
async function runSupabaseOnly<T>(
  supabaseOp: () => Promise<{ data: T | null; error: any }>,
  opName: string
): Promise<T> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase client is not initialized");
  }
  const { data, error } = await supabaseOp();
  if (error) {
    // .single() with zero rows is "not found", not a failure
    if (error.code === "PGRST116" || /0 rows|multiple \(or no\) rows/i.test(error.message || "")) {
      return (data ?? null) as T;
    }
    console.error(`[DB] Supabase failed for "${opName}": ${error.message}`);
    throw error;
  }
  return (data ?? null) as T;
}

// Contacts Operations
export interface Contact {
  id: string;
  user_id: string;
  name: string;
  company: string;
  phone: string;
  notes: string;
  created_at: string;
}

export async function saveUser(uid: string, email: string, displayName: string, role = "user", status = "active") {
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("users")
        .upsert({ id: uid, email, display_name: displayName, role, status }, { onConflict: "id" })
        .select()
        .single();
      return { data, error };
    }, "saveUser");
}

export async function getUser(uid: string) {
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", uid)
        .single();
      return { data, error };
    }, "getUser");
}

export async function createContact(userId: string, name: string, company: string, phone: string, notes: string): Promise<Contact> {
  const newContact = {
    user_id: userId,
    name: name || "Unknown",
    company: company || "",
    phone: phone || "",
    notes: notes || "",
    created_at: new Date().toISOString()
  };

  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("contacts")
        .insert(newContact)
        .select()
        .single();
      return { data: data as Contact, error };
    }, "createContact");
}

export async function listContacts(userId: string): Promise<Contact[]> {
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", userId)
        .order("name", { ascending: true });
      return { data: data as Contact[], error };
    }, "listContacts");
}

// Resolves a requested contactId to a real, existing contact for this user --
// auto-creating (and reusing) a single "Default Contact" if the user has none yet,
// or falling back to their first contact if an unknown/stale ID was passed in.
// Centralizes logic that used to be duplicated across the WS handler and REST route.
export async function deleteContact(userId: string, contactId: string): Promise<void> {
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contactId)
        .eq("user_id", userId);
      return { data: undefined, error };
    }, "deleteContact");
}

export async function resolveContactId(userId: string, requestedContactId?: string | null): Promise<string> {
  const contactsList = await listContacts(userId);

  if (requestedContactId) {
    const exists = contactsList.some(c => c.id === requestedContactId);
    if (exists) return requestedContactId;
  }

  if (contactsList.length > 0) {
    return contactsList[0].id;
  }

  const newContact = await createContact(
    userId,
    "Default Contact",
    "Responsive AI",
    "+1 555-0199",
    "Auto-generated default contact"
  );
  return newContact.id;
}

// Call Sessions Operations
export interface CallSession {
  id: string;
  user_id: string;
  contact_id?: string;
  personality_id?: string;
  personality_name?: string;
  selected_voice: string;
  status: "active" | "completed" | "failed";
  duration_seconds: number;
  created_at: string;
  ended_at?: string;
  ai_notes?: string;
  // Included fields for UI ease
  contact_name?: string;
  contact_company?: string;
}

export async function createCallSession(userId: string, contactId: string | null, selectedVoice: string, personalityId?: string, personalityName?: string): Promise<CallSession> {
  const newSession = {
    user_id: userId,
    contact_id: contactId || undefined,
    personality_id: personalityId || undefined,
    personality_name: personalityName || undefined,
    selected_voice: selectedVoice,
    status: "active" as const,
    duration_seconds: 0,
    created_at: new Date().toISOString()
  };

  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("call_sessions")
        .insert(newSession)
        .select()
        .single();
      return { data: data as CallSession, error };
    }, "createCallSession");
}

export async function updateCallSession(callId: string, durationSeconds: number, endedAt: string, aiNotes?: string): Promise<void> {
  const updateData: any = {
    status: "completed",
    duration_seconds: durationSeconds,
    ended_at: endedAt
  };
  if (aiNotes) {
    updateData.ai_notes = aiNotes;
  }

  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("call_sessions")
        .update(updateData)
        .eq("id", callId);
      return { data: undefined, error };
    }, "updateCallSession");
}

export async function listCallSessions(userId: string): Promise<CallSession[]> {
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      // Try to fetch call sessions with contacts joined
      const { data, error } = await supabase
        .from("call_sessions")
        .select(`
          *,
          contacts (
            name,
            company
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const mapped = (data || []).map((session: any) => ({
        ...session,
        contact_name: session.contacts?.name || "Unknown",
        contact_company: session.contacts?.company || ""
      })) as CallSession[];

      return { data: mapped, error };
    }, "listCallSessions");
}

export async function listAllCallSessionsForAdmin(): Promise<CallSession[]> {
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("call_sessions")
        .select(`
          *,
          contacts (
            name,
            company
          )
        `)
        .order("created_at", { ascending: false });

      const mapped = (data || []).map((session: any) => ({
        ...session,
        contact_name: session.contacts?.name || "Unknown",
        contact_company: session.contacts?.company || ""
      })) as CallSession[];

      return { data: mapped, error };
    }, "listAllCallSessionsForAdmin");
}

// Transcript Messages Operations
export interface TranscriptMessage {
  id?: string;
  call_session_id: string;
  speaker: "User" | "AI";
  message: string;
  timestamp: string;
}

export async function saveTranscriptMessages(callSessionId: string, messages: TranscriptMessage[]): Promise<void> {
  if (!messages || messages.length === 0) return;

  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const rows = messages.map(m => ({
        call_session_id: callSessionId,
        speaker: m.speaker,
        message: m.message,
        timestamp: m.timestamp || new Date().toISOString()
      }));
      const { error } = await supabase
        .from("transcript_messages")
        .insert(rows);
      return { data: undefined, error };
    }, "saveTranscriptMessages");
}

export async function listTranscriptMessages(callSessionId: string): Promise<TranscriptMessage[]> {
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("transcript_messages")
        .select("*")
        .eq("call_session_id", callSessionId)
        .order("timestamp", { ascending: true });
      return { data: data as TranscriptMessage[], error };
    }, "listTranscriptMessages");
}

// Conversation Memory: fetch a contact's last completed call + transcript so the
// AI persona can carry context forward on the next call back to the same contact.
export interface ConversationMemory {
  callSessionId: string;
  endedAt: string;
  transcript: TranscriptMessage[];
}

export async function getLastConversationForContact(
  userId: string,
  contactId: string,
  excludeCallSessionId?: string
): Promise<ConversationMemory | null> {
  const lastSession = await runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      let query = supabase
        .from("call_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("contact_id", contactId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(5);
      const { data, error } = await query;
      if (error) return { data: null, error };
      const filtered = (data || []).filter((s: any) => s.id !== excludeCallSessionId);
      return { data: (filtered[0] as CallSession) || null, error: null };
    }, "getLastConversationForContact");

  if (!lastSession || !lastSession.id) return null;

  const transcript = await listTranscriptMessages(lastSession.id);
  if (!transcript || transcript.length === 0) return null;

  return {
    callSessionId: lastSession.id,
    endedAt: lastSession.ended_at || lastSession.created_at,
    transcript
  };
}

// Condenses a conversation memory into a compact text block safe to inject into a
// system prompt (capped so we never blow up context with a long call history).
export function formatConversationMemoryForPrompt(memory: ConversationMemory, maxChars = 2000): string {
  const lines = memory.transcript.map(m => `${m.speaker}: ${m.message}`);
  let joined = lines.join("\n");
  if (joined.length > maxChars) {
    // Keep the most recent context, since it's usually most relevant to "picking back up"
    joined = "...\n" + joined.slice(joined.length - maxChars);
  }
  return joined;
}

// AI Commands Operations
export interface AICommand {
  id?: string;
  call_session_id: string;
  command: string;
  created_at: string;
}

export async function addAICommand(callSessionId: string, command: string): Promise<void> {
  const row = {
    call_session_id: callSessionId,
    command,
    created_at: new Date().toISOString()
  };

  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("ai_commands")
        .insert(row);
      return { data: undefined, error };
    }, "addAICommand");
}

// User Preferences Operations
export interface UserPreferences {
  user_id: string;
  default_voice: string;
  ai_personality: string;
  ai_speed: number;
}

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const defaultPrefs: UserPreferences = {
    user_id: userId,
    default_voice: "Zephyr",
    ai_personality: "friendly",
    ai_speed: 1.0
  };

  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", userId)
        .single();
      return { data: data as UserPreferences || defaultPrefs, error };
    }, "getPreferences");
}

export async function updatePreferences(userId: string, prefs: Partial<UserPreferences>): Promise<void> {
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" });
      return { data: undefined, error };
    }, "updatePreferences");
}

// Admin / Audit Logging Operations
export interface AdminLog {
  id?: string;
  admin_id: string;
  admin_email: string;
  action: string;
  target_id: string;
  target_email: string;
  details: string;
  timestamp: string;
}

export async function addAdminLog(
  adminId: string,
  adminEmail: string,
  action: string,
  targetId: string,
  targetEmail: string,
  details: string
): Promise<void> {
  const row = {
    admin_id: adminId,
    admin_email: adminEmail,
    action,
    target_id: targetId,
    target_email: targetEmail,
    details,
    timestamp: new Date().toISOString()
  };

  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("admin_logs")
        .insert(row);
      return { data: undefined, error };
    }, "addAdminLog");
}

export async function listAllAdminLogs(): Promise<AdminLog[]> {
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("admin_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(100);
      return { data: data as AdminLog[], error };
    }, "listAllAdminLogs");
}

export async function listAllUsers(): Promise<any[]> {
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });
      return { data, error };
    }, "listAllUsers");
}

export async function updateUserStatus(targetUid: string, status: string): Promise<void> {
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("users")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", targetUid);
      return { data: undefined, error };
    }, "updateUserStatus");
}


// ─── Personality Operations ───────────────────────────────────────────────────
export interface Personality {
  id: string;
  user_id: string;
  name: string;
  role: string;
  communication_style: string;
  knowledge_area: string;
  behavior_pattern: string;
  voice_id: string;
  created_at: string;
}

export async function createPersonality(
  userId: string,
  name: string,
  role: string,
  communicationStyle: string,
  knowledgeArea: string,
  behaviorPattern: string,
  voiceId: string = "Zephyr"
): Promise<Personality> {
  const record = {
    user_id: userId,
    name,
    role,
    communication_style: communicationStyle,
    knowledge_area: knowledgeArea,
    behavior_pattern: behaviorPattern,
    voice_id: voiceId,
    created_at: new Date().toISOString()
  };
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("personalities")
        .insert(record)
        .select()
        .single();
      return { data: data as Personality, error };
    }, "createPersonality");
}

export async function listPersonalities(userId: string): Promise<Personality[]> {
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("personalities")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return { data: data as Personality[], error };
    }, "listPersonalities");
}

export async function updatePersonality(
  personalityId: string,
  userId: string,
  updates: Partial<Omit<Personality, "id" | "user_id" | "created_at">>
): Promise<Personality> {
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("personalities")
        .update(updates)
        .eq("id", personalityId)
        .eq("user_id", userId)
        .select()
        .single();
      return { data: data as Personality, error };
    }, "updatePersonality");
}

export async function deletePersonality(personalityId: string, userId: string): Promise<void> {
  return runSupabaseOnly(async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("personalities")
        .delete()
        .eq("id", personalityId)
        .eq("user_id", userId);
      return { data: undefined, error };
    }, "deletePersonality");
}

export function buildPersonalitySystemPrompt(p: Personality, callTopic?: string): string {
  let prompt = `You are ${p.name}, a ${p.role}.
Your communication style: ${p.communication_style}.
Your knowledge area: ${p.knowledge_area}.
Your behavior pattern: ${p.behavior_pattern}.
Stay fully in character at all times. Be natural, conversational and engaging.`;
  if (callTopic) {
    prompt += `\n\nThe user wants to focus this conversation on: ${callTopic}. Naturally steer towards this topic.`;
  }
  return prompt;
}
