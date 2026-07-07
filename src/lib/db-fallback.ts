import { getSupabaseAdmin } from "./supabase-admin";
import { adminDb } from "./firebase-admin";

// Utility to catch Supabase failures and fall back to Firestore
async function runWithFallback<T>(
  supabaseOp: () => Promise<{ data: T | null; error: any }>,
  firestoreOp: () => Promise<T>,
  opName: string
): Promise<T> {
  try {
    const supabase = getSupabaseAdmin();
    // Test if supabase client is active
    if (!supabase) {
      throw new Error("Supabase client is not initialized");
    }
    const { data, error } = await supabaseOp();
    if (error) {
      // Check if it is a missing table error
      if (
        error.message?.includes("cache") || 
        error.message?.includes("relation") || 
        error.code === "P0001" || 
        error.status === 404
      ) {
        console.warn(`[DB-FALLBACK] Supabase table missing/error for "${opName}". Falling back to Firestore. Error: ${error.message}`);
        return await firestoreOp();
      }
      throw error;
    }
    if (data === null || data === undefined) {
      // If we got null from supabase but it succeeded, that's fine, return it
      return data as T;
    }
    return data;
  } catch (err: any) {
    console.warn(`[DB-FALLBACK] Supabase failed for "${opName}" (${err.message}). Falling back to Firestore.`);
    try {
      return await firestoreOp();
    } catch (fsErr: any) {
      console.error(`[DB-FALLBACK] Firestore also failed for "${opName}":`, fsErr.message);
      throw fsErr;
    }
  }
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
  return runWithFallback(
    async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("users")
        .upsert({ id: uid, email, display_name: displayName, role, status }, { onConflict: "id" })
        .select()
        .single();
      return { data, error };
    },
    async () => {
      const docRef = adminDb.collection("users").doc(uid);
      await docRef.set({
        id: uid,
        email,
        display_name: displayName,
        role,
        status,
        updated_at: new Date().toISOString()
      }, { merge: true });
      return { id: uid, email, display_name: displayName, role, status };
    },
    "saveUser"
  );
}

export async function getUser(uid: string) {
  return runWithFallback(
    async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", uid)
        .single();
      return { data, error };
    },
    async () => {
      const doc = await adminDb.collection("users").doc(uid).get();
      if (!doc.exists) return null;
      return doc.data();
    },
    "getUser"
  );
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

  return runWithFallback<Contact>(
    async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("contacts")
        .insert(newContact)
        .select()
        .single();
      return { data: data as Contact, error };
    },
    async () => {
      const docRef = await adminDb.collection("contacts").add(newContact);
      return { id: docRef.id, ...newContact };
    },
    "createContact"
  );
}

export async function listContacts(userId: string): Promise<Contact[]> {
  return runWithFallback<Contact[]>(
    async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", userId)
        .order("name", { ascending: true });
      return { data: data as Contact[], error };
    },
    async () => {
      const snapshot = await adminDb
        .collection("contacts")
        .where("user_id", "==", userId)
        .get();
      const list: Contact[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as Contact);
      });
      return list.sort((a, b) => a.name.localeCompare(b.name));
    },
    "listContacts"
  );
}

// Resolves a requested contactId to a real, existing contact for this user --
// auto-creating (and reusing) a single "Default Contact" if the user has none yet,
// or falling back to their first contact if an unknown/stale ID was passed in.
// Centralizes logic that used to be duplicated across the WS handler and REST route.
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

export async function createCallSession(userId: string, contactId: string | null, selectedVoice: string): Promise<CallSession> {
  const newSession = {
    user_id: userId,
    contact_id: contactId || undefined,
    selected_voice: selectedVoice,
    status: "active" as const,
    duration_seconds: 0,
    created_at: new Date().toISOString()
  };

  return runWithFallback<CallSession>(
    async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("call_sessions")
        .insert(newSession)
        .select()
        .single();
      return { data: data as CallSession, error };
    },
    async () => {
      const docRef = await adminDb.collection("call_sessions").add(newSession);
      return { id: docRef.id, ...newSession } as CallSession;
    },
    "createCallSession"
  );
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

  return runWithFallback<void>(
    async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("call_sessions")
        .update(updateData)
        .eq("id", callId);
      return { data: undefined, error };
    },
    async () => {
      await adminDb.collection("call_sessions").doc(callId).update(updateData);
    },
    "updateCallSession"
  );
}

export async function listCallSessions(userId: string): Promise<CallSession[]> {
  return runWithFallback<CallSession[]>(
    async () => {
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
    },
    async () => {
      // Step 1: Get all call sessions
      const sessionsSnap = await adminDb
        .collection("call_sessions")
        .where("user_id", "==", userId)
        .get();
      
      const sessions: any[] = [];
      sessionsSnap.forEach(doc => {
        sessions.push({ id: doc.id, ...doc.data() });
      });

      // Step 2: Get all contacts to map contact names
      const contactsSnap = await adminDb
        .collection("contacts")
        .where("user_id", "==", userId)
        .get();
      
      const contactsMap: { [id: string]: { name: string; company: string } } = {};
      contactsSnap.forEach(doc => {
        contactsMap[doc.id] = doc.data() as any;
      });

      // Step 3: Map contacts onto sessions
      const mapped = sessions.map(session => {
        const contact = session.contact_id ? contactsMap[session.contact_id] : null;
        return {
          ...session,
          contact_name: contact?.name || "Unknown",
          contact_company: contact?.company || ""
        };
      });

      // Sort descending
      return mapped.sort((a, b) => b.created_at.localeCompare(a.created_at)) as CallSession[];
    },
    "listCallSessions"
  );
}

export async function listAllCallSessionsForAdmin(): Promise<CallSession[]> {
  return runWithFallback<CallSession[]>(
    async () => {
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
    },
    async () => {
      const sessionsSnap = await adminDb.collection("call_sessions").get();
      const sessions: any[] = [];
      sessionsSnap.forEach(doc => {
        sessions.push({ id: doc.id, ...doc.data() });
      });

      const contactsSnap = await adminDb.collection("contacts").get();
      const contactsMap: { [id: string]: { name: string; company: string } } = {};
      contactsSnap.forEach(doc => {
        contactsMap[doc.id] = doc.data() as any;
      });

      const mapped = sessions.map(session => {
        const contact = session.contact_id ? contactsMap[session.contact_id] : null;
        return {
          ...session,
          contact_name: contact?.name || "Unknown",
          contact_company: contact?.company || ""
        };
      });

      return mapped.sort((a, b) => b.created_at.localeCompare(a.created_at)) as CallSession[];
    },
    "listAllCallSessionsForAdmin"
  );
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

  return runWithFallback<void>(
    async () => {
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
    },
    async () => {
      const batch = adminDb.batch();
      const collectionRef = adminDb.collection("transcript_messages");
      
      for (const m of messages) {
        const docRef = collectionRef.doc();
        batch.set(docRef, {
          call_session_id: callSessionId,
          speaker: m.speaker,
          message: m.message,
          timestamp: m.timestamp || new Date().toISOString()
        });
      }
      await batch.commit();
    },
    "saveTranscriptMessages"
  );
}

export async function listTranscriptMessages(callSessionId: string): Promise<TranscriptMessage[]> {
  return runWithFallback<TranscriptMessage[]>(
    async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("transcript_messages")
        .select("*")
        .eq("call_session_id", callSessionId)
        .order("timestamp", { ascending: true });
      return { data: data as TranscriptMessage[], error };
    },
    async () => {
      const snapshot = await adminDb
        .collection("transcript_messages")
        .where("call_session_id", "==", callSessionId)
        .get();
      const list: TranscriptMessage[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as TranscriptMessage);
      });
      // Sort by timestamp
      return list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    },
    "listTranscriptMessages"
  );
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
  const lastSession = await runWithFallback<CallSession | null>(
    async () => {
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
    },
    async () => {
      const snap = await adminDb
        .collection("call_sessions")
        .where("user_id", "==", userId)
        .where("contact_id", "==", contactId)
        .where("status", "==", "completed")
        .get();
      const sessions: any[] = [];
      snap.forEach(doc => sessions.push({ id: doc.id, ...doc.data() }));
      const filtered = sessions
        .filter(s => s.id !== excludeCallSessionId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return (filtered[0] as CallSession) || null;
    },
    "getLastConversationForContact"
  );

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

  return runWithFallback<void>(
    async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("ai_commands")
        .insert(row);
      return { data: undefined, error };
    },
    async () => {
      await adminDb.collection("ai_commands").add(row);
    },
    "addAICommand"
  );
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

  return runWithFallback<UserPreferences>(
    async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", userId)
        .single();
      return { data: data as UserPreferences || defaultPrefs, error };
    },
    async () => {
      const doc = await adminDb.collection("user_preferences").doc(userId).get();
      if (!doc.exists) return defaultPrefs;
      return { ...defaultPrefs, ...doc.data() };
    },
    "getPreferences"
  );
}

export async function updatePreferences(userId: string, prefs: Partial<UserPreferences>): Promise<void> {
  return runWithFallback<void>(
    async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" });
      return { data: undefined, error };
    },
    async () => {
      await adminDb.collection("user_preferences").doc(userId).set(prefs, { merge: true });
    },
    "updatePreferences"
  );
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

  return runWithFallback<void>(
    async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("admin_logs")
        .insert(row);
      return { data: undefined, error };
    },
    async () => {
      await adminDb.collection("admin_logs").add(row);
    },
    "addAdminLog"
  );
}

export async function listAllAdminLogs(): Promise<AdminLog[]> {
  return runWithFallback<AdminLog[]>(
    async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("admin_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(100);
      return { data: data as AdminLog[], error };
    },
    async () => {
      const snapshot = await adminDb
        .collection("admin_logs")
        .orderBy("timestamp", "desc")
        .limit(100)
        .get();
      const list: AdminLog[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as AdminLog);
      });
      return list;
    },
    "listAllAdminLogs"
  );
}

export async function listAllUsers(): Promise<any[]> {
  return runWithFallback<any[]>(
    async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });
      return { data, error };
    },
    async () => {
      const snapshot = await adminDb.collection("users").get();
      const list: any[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list.sort((a, b) => b.updated_at?.localeCompare(a.updated_at || "") || 0);
    },
    "listAllUsers"
  );
}

export async function updateUserStatus(targetUid: string, status: string): Promise<void> {
  return runWithFallback<void>(
    async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("users")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", targetUid);
      return { data: undefined, error };
    },
    async () => {
      await adminDb.collection("users").doc(targetUid).update({
        status,
        updated_at: new Date().toISOString()
      });
    },
    "updateUserStatus"
  );
}

