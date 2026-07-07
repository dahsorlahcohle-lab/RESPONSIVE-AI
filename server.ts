import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Modality } from "@google/genai";
import { getSupabaseAdmin } from "./src/lib/supabase-admin";
import { 
  saveUser, 
  getUser, 
  createContact, 
  listContacts, 
  createCallSession, 
  updateCallSession, 
  listCallSessions, 
  saveTranscriptMessages, 
  listTranscriptMessages, 
  addAICommand, 
  getPreferences, 
  updatePreferences,
  addAdminLog,
  listAllAdminLogs,
  listAllUsers,
  updateUserStatus,
  listAllCallSessionsForAdmin,
  getLastConversationForContact,
  formatConversationMemoryForPrompt,
  resolveContactId
} from "./src/lib/db-fallback";

dotenv.config();

// Helper to log administrative audit actions
async function logAdminAction(adminUid: string, adminEmail: string, action: string, targetUid: string, targetEmail: string, details: string) {
  try {
    await addAdminLog(adminUid, adminEmail, action, targetUid, targetEmail, details);
  } catch (err) {
    console.error("Failed to write admin audit log:", err);
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  const PORT = 3000;

  // Middleware for body-parsing
  app.use(express.json());

  // Health check API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Supabase connection diagnostic endpoint
  app.get("/api/supabase/health", async (req, res) => {
    try {
      // Query session configuration/auth to test basic connectivity
      const { data, error } = await getSupabaseAdmin().auth.getSession();
      if (error) {
        return res.status(500).json({ status: "error", message: "Supabase authentication test failed", error: error.message });
      }
      res.json({
        status: "ok",
        message: "Successfully connected to Supabase!",
        url: process.env.SUPABASE_URL || "Configured",
        time: new Date().toISOString()
      });
    } catch (err: any) {
      console.error("Supabase connection check failed:", err);
      res.status(500).json({ status: "error", message: err.message || "Failed to communicate with Supabase" });
    }
  });

  // Token authentication middleware
  const authenticateUser = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing token" });
    }
    const token = authHeader.split("Bearer ")[1];
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) {
        throw new Error(error?.message || "Invalid Supabase token");
      }

      // Try to fetch profile from database fallback layer
      const profile = await getUser(user.id);

      const isDefaultAdmin = user.email === "dahsorlahcohle@gmail.com";
      let role = isDefaultAdmin ? "admin" : "user";
      let status = "active";

      if (profile) {
        role = profile.role || role;
        status = profile.status || status;
      }

      req.user = {
        uid: user.id,
        email: user.email,
        displayName: user.user_metadata?.displayName || user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        role,
        status
      };
      req.token = token;
      next();
    } catch (err: any) {
      console.error("Token verification failed:", err.message);
      return res.status(401).json({ success: false, error: "Unauthorized: Invalid token" });
    }
  };

  // Admin authorization middleware
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    if (req.user.role === "admin" || req.user.email === "dahsorlahcohle@gmail.com") {
      return next();
    }
    return res.status(403).json({ success: false, error: "Forbidden: Administrators only" });
  };

  // 1. Profile registration on signup/login
  app.post("/api/auth/register-profile", authenticateUser, async (req: any, res: any) => {
    const { uid, email, displayName } = req.user;
    try {
      const userProfile = await getUser(uid);

      const isDefaultAdmin = email === "dahsorlahcohle@gmail.com";
      const determinedRole = isDefaultAdmin ? "admin" : "user";

      if (!userProfile) {
        // Create new user profile in database fallback layer
        await saveUser(uid, email || "", displayName || email?.split("@")[0] || "User", determinedRole, "active");

        // Also bootstrap preferences entry
        await updatePreferences(uid, {
          user_id: uid,
          default_voice: "Zephyr",
          ai_personality: "friendly",
          ai_speed: 1.0
        });

        return res.json({ success: true, isNew: true, role: determinedRole, status: "active" });
      } else {
        // If they are default admin but not marked as admin, update them
        if (isDefaultAdmin && userProfile.role !== "admin") {
          await saveUser(uid, email || "", displayName || email?.split("@")[0] || "User", "admin", "active");
          userProfile.role = "admin";
        }
        return res.json({ success: true, isNew: false, role: userProfile.role || determinedRole, status: userProfile.status });
      }
    } catch (err: any) {
      console.error("Profile registration error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to sync profile" });
    }
  });

  // ============================================================================
  // USER CONTACTS, CALLS, TRANSCRIPTS, & PREFERENCES API ENDPOINTS
  // ============================================================================

  // List all contacts for the authenticated user
  app.get("/api/contacts", authenticateUser, async (req: any, res: any) => {
    try {
      const contacts = await listContacts(req.user.uid);
      res.json({ success: true, contacts });
    } catch (err: any) {
      console.error("Error listing contacts:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Create a new contact
  app.post("/api/contacts", authenticateUser, async (req: any, res: any) => {
    const { name, company, phone, notes } = req.body;
    try {
      const contact = await createContact(req.user.uid, name, company, phone, notes);
      res.json({ success: true, contact });
    } catch (err: any) {
      console.error("Error creating contact:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get the last completed conversation transcript for a specific contact
  // (what the AI persona now automatically recalls when calling this contact back)
  app.get("/api/contacts/:id/last-conversation", authenticateUser, async (req: any, res: any) => {
    try {
      const memory = await getLastConversationForContact(req.user.uid, req.params.id);
      res.json({ success: true, memory });
    } catch (err: any) {
      console.error("Error fetching last conversation for contact:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get user preferences
  app.get("/api/preferences", authenticateUser, async (req: any, res: any) => {
    try {
      const preferences = await getPreferences(req.user.uid);
      res.json({ success: true, preferences });
    } catch (err: any) {
      console.error("Error getting preferences:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Update user preferences
  app.post("/api/preferences", authenticateUser, async (req: any, res: any) => {
    try {
      await updatePreferences(req.user.uid, req.body);
      res.json({ success: true, message: "Preferences updated successfully" });
    } catch (err: any) {
      console.error("Error updating preferences:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // List call history for the authenticated user
  app.get("/api/calls", authenticateUser, async (req: any, res: any) => {
    try {
      const calls = await listCallSessions(req.user.uid);
      res.json({ success: true, calls });
    } catch (err: any) {
      console.error("Error listing call sessions:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Start/Create a new call session
  app.post("/api/calls", authenticateUser, async (req: any, res: any) => {
    const { contactId, selectedVoice } = req.body;
    try {
      const resolvedContactId = await resolveContactId(req.user.uid, contactId);

      const session = await createCallSession(req.user.uid, resolvedContactId, selectedVoice || "Zephyr");
      res.json({ success: true, session, contactId: resolvedContactId });
    } catch (err: any) {
      console.error("Error creating call session:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // End a call session (sets duration, status completed, optional AI summary)
  app.post("/api/calls/:id/end", authenticateUser, async (req: any, res: any) => {
    const { durationSeconds, aiNotes } = req.body;
    try {
      await updateCallSession(req.params.id, durationSeconds || 0, new Date().toISOString(), aiNotes || "");
      res.json({ success: true, message: "Call session completed successfully" });
    } catch (err: any) {
      console.error("Error ending call session:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Save full call transcript batch
  app.post("/api/calls/:id/transcript", authenticateUser, async (req: any, res: any) => {
    const { messages } = req.body;
    try {
      await saveTranscriptMessages(req.params.id, messages || []);
      res.json({ success: true, message: "Transcript messages saved successfully" });
    } catch (err: any) {
      console.error("Error saving transcript messages:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Fetch transcript for a call session
  app.get("/api/calls/:id/transcript", authenticateUser, async (req: any, res: any) => {
    try {
      const messages = await listTranscriptMessages(req.params.id);
      res.json({ success: true, messages });
    } catch (err: any) {
      console.error("Error fetching transcript:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Log private AI command
  app.post("/api/calls/:id/commands", authenticateUser, async (req: any, res: any) => {
    const { command } = req.body;
    try {
      await addAICommand(req.params.id, command || "");
      res.json({ success: true, message: "AI Command logged successfully" });
    } catch (err: any) {
      console.error("Error logging AI Command:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ============================================================================
  // ADMIN INTERFACE ENDPOINTS
  // ============================================================================

  // 2. Admin Interface: View all registered users
  app.get("/api/admin/users", authenticateUser, requireAdmin, async (req: any, res: any) => {
    try {
      const users = await listAllUsers();
      const mappedUsers = (users || []).map(u => ({
        uid: u.id,
        email: u.email,
        displayName: u.display_name,
        role: u.role,
        status: u.status,
        createdAt: u.created_at || u.updated_at,
        updatedAt: u.updated_at
      }));

      res.json({ success: true, users: mappedUsers });
    } catch (err: any) {
      console.error("Error listing users:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Admin Interface: Suspend, deactivate, or reactivate user accounts
  app.post("/api/admin/user-status", authenticateUser, requireAdmin, async (req: any, res: any) => {
    const { targetUid, status } = req.body;
    if (!targetUid || !status) {
      return res.status(400).json({ success: false, error: "Missing required fields targetUid or status" });
    }
    
    if (targetUid === req.user.uid) {
      return res.status(400).json({ success: false, error: "You cannot change your own account status." });
    }

    try {
      const targetUser = await getUser(targetUid);
      if (!targetUser) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const oldStatus = targetUser.status || "active";
      await updateUserStatus(targetUid, status);

      // Log action for auditing
      await logAdminAction(
        req.user.uid,
        req.user.email,
        status === "suspended" ? "suspend_user" : "reactivate_user",
        targetUid,
        targetUser.email || "",
        `Changed status from ${oldStatus} to ${status}`
      );

      res.json({ success: true, message: `User status updated to ${status}` });
    } catch (err: any) {
      console.error("Error updating user status:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Admin Interface: Access analytics, system reports and monitor activity
  app.get("/api/admin/stats", authenticateUser, requireAdmin, async (req: any, res: any) => {
    try {
      const users = await listAllUsers();
      const calls = await listAllCallSessionsForAdmin();

      let totalSeconds = 0;
      let activeCallsCount = 0;
      const recentCalls: any[] = [];

      (calls || []).forEach(data => {
        totalSeconds += data.duration_seconds || 0;
        if (data.status === "active") {
          activeCallsCount++;
        }
        
        recentCalls.push({
          id: data.id,
          uid: data.user_id,
          userEmail: (data as any).user_email || "anonymous@applet.com",
          voiceId: data.selected_voice,
          status: data.status,
          durationSeconds: data.duration_seconds || 0,
          createdAt: data.created_at || null
        });
      });

      // Sort recent calls by createdAt desc
      recentCalls.sort((a, b) => {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

      res.json({
        success: true,
        stats: {
          userCount: users?.length || 0,
          callCount: calls?.length || 0,
          totalSeconds,
          activeCallsCount,
          recentCalls: recentCalls.slice(0, 15) // Top 15 recent calls
        }
      });
    } catch (err: any) {
      console.error("Error fetching admin stats:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Admin Interface: Access audit logs
  app.get("/api/admin/logs", authenticateUser, requireAdmin, async (req: any, res: any) => {
    try {
      const logs = await listAllAdminLogs();
      const mappedLogs = (logs || []).map(l => ({
        id: l.id,
        adminUid: l.admin_id,
        adminEmail: l.admin_email,
        action: l.action,
        targetUid: l.target_id,
        targetEmail: l.target_email,
        details: l.details,
        timestamp: l.timestamp
      }));

      res.json({ success: true, logs: mappedLogs });
    } catch (err: any) {
      console.error("Error fetching audit logs:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Handle WebSocket upgrades
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    if (url.pathname === "/api/ws" || url.pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  // WebSocket Server logic (Token Authorized)
  wss.on("connection", async (ws: WebSocket, request: any) => {
    console.log("Client connecting to Voice Pipeline WS...");
    let geminiSession: any = null;
    let isConnectingGemini = false;

    // Extract authorization token from query string
    const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
    const token = url.searchParams.get("token");

    const sendError = (msg: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", data: { message: msg } }));
      }
    };

    const sendStatus = (state: "listening" | "thinking" | "speaking" | "idle" | "connected" | "connecting") => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "status", data: { state } }));
      }
    };

    if (!token) {
      console.log("WebSocket rejected: Missing token");
      sendError("Authentication required: Missing token.");
      ws.close(1008, "Missing Token");
      return;
    }

    let decodedUser: any = null;
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) {
        throw new Error(error?.message || "Invalid Supabase token");
      }
      decodedUser = {
        uid: user.id,
        email: user.email
      };
    } catch (err: any) {
      console.log("WebSocket rejected: Invalid token:", err.message);
      sendError("Authentication failed: Invalid token.");
      ws.close(1008, "Invalid Token");
      return;
    }

    console.log(`WebSocket user authenticated: ${decodedUser.email} (${decodedUser.uid})`);

    // Verify user is not suspended
    try {
      const userData = await getUser(decodedUser.uid);
      if (userData && userData.status === "suspended") {
        console.log(`WebSocket rejected: Suspended user ${decodedUser.email}`);
        sendError("Your account has been suspended by an administrator.");
        ws.close(1008, "User Suspended");
        return;
      }
    } catch (err) {
      console.error("Error validating user status on WS connection:", err);
    }

    // Call logging variables
    let callId: string | null = null;
    let callStartTime = Date.now();
    let currentVoiceId = "Zephyr";

    const startCallLogging = async (voiceId: string, contactId?: string) => {
      try {
        const voiceName = voiceId || "Zephyr";
        currentVoiceId = voiceName;
        callStartTime = Date.now();

        // contactId is expected to already be resolved by connectGemini before the
        // Gemini session was opened, but resolve again defensively in case
        // startCallLogging is ever called on its own with a raw/unresolved id.
        const resolvedContactId = await resolveContactId(decodedUser.uid, contactId);

        const callSession = await createCallSession(decodedUser.uid, resolvedContactId, voiceName);
        callId = callSession?.id || null;
        console.log(`Call log active in fallback DB: ${callId}`);

        // Broadcast active callId and contactId back to the client immediately
        if (callId && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "call_id",
            data: { callId, contactId: resolvedContactId }
          }));
        }
      } catch (err) {
        console.error("Failed to write active call log:", err);
      }
    };

    const finishCallLogging = async () => {
      if (callId) {
        const durationSeconds = Math.floor((Date.now() - callStartTime) / 1000);
        try {
          await updateCallSession(callId, durationSeconds, new Date().toISOString(), "Completed call");
          console.log(`Call log updated to completed in fallback DB: ${callId} (${durationSeconds}s)`);
        } catch (err) {
          console.error("Failed to update call log:", err);
        }
        callId = null;
      }
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("No GEMINI_API_KEY environment variable set.");
      sendError("Server configuration error: Gemini API Key is missing.");
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    const connectGemini = async (systemPrompt: string, voiceId: string, isUpdate = false, contactId?: string) => {
      if (isConnectingGemini) {
        console.log("Already establishing connection, ignoring request");
        return;
      }

      if (geminiSession) {
        console.log("Closing active Gemini session for voice update...");
        try {
          geminiSession.close();
        } catch (err) {
          console.error("Error closing existing Gemini session:", err);
        }
        geminiSession = null;
      }

      isConnectingGemini = true;
      sendStatus("connecting");

      try {
        if (!apiKey) {
          throw new Error("GEMINI_API_KEY environment variable is required but missing");
        }

        // 1. Retrieve the user's active personality & voice preference from user_preferences table
        const prefs = await getPreferences(decodedUser.uid);
        const resolvedVoice = voiceId || prefs?.default_voice || "Zephyr";
        const resolvedPersonaId = prefs?.ai_personality || "friendly";

        // 2. Set the appropriate system instruction in Gemini based on the active personality
        const foundPersona = [
          { id: "friendly", prompt: "You are an engaging phone partner. Keep your replies friendly, conversational, and concise. Ask questions to keep the flow alive!" },
          { id: "interviewer", prompt: "You are a professional, slightly tough technical interviewer conducting a phone screen. Give concise, sharp questions and realistic feedback." },
          { id: "tutor", prompt: "You are a helpful and supportive Spanish conversation teacher. Speak in a mix of slow Spanish and English. Correct my mistakes kindly." },
          { id: "coach", prompt: "You are a peaceful, calm meditation guide. Walk me through rhythmic breathing exercises and offer short, soothing reflections." }
        ].find(p => p.id === resolvedPersonaId);

        const resolvedPrompt = foundPersona ? foundPersona.prompt : (systemPrompt || "You are an engaging phone partner. Keep your replies friendly, conversational, and concise. Ask questions to keep the flow alive!");

        // 3. Resolve the contact for this call up front (auto-creates/reuses a Default
        // Contact if needed) so we can look up the last completed conversation with
        // them and give the AI real memory of it before the call even connects.
        const resolvedContactId = await resolveContactId(decodedUser.uid, contactId);

        let memoryBlock = "";
        try {
          const lastConversation = await getLastConversationForContact(decodedUser.uid, resolvedContactId);
          if (lastConversation) {
            const memoryText = formatConversationMemoryForPrompt(lastConversation);
            memoryBlock = `\n\nMEMORY FROM YOUR LAST CALL WITH THIS CONTACT (use this naturally to pick up where you left off or answer questions about it -- never say "according to my notes" or reference this being logged/recorded):\n${memoryText}`;
          }
        } catch (err) {
          console.error("Failed to load last conversation memory for contact:", err);
        }

        const augmentedPrompt = `${resolvedPrompt}\n\nCRITICAL PHONE CALL GUIDELINES:\n1. You are in a direct, real-time live phone call. \n2. NEVER mention or reference your "system prompt", "instructions", "instructions provided", "context", "prompt setup", "scenario description", "guidelines", or "roleplay". \n3. NEVER say things like "Based on your prompt", "According to the instructions", "In this scenario", or "Since you instructed me to". \n4. Stay 100% in character naturally from the very first word. Respond directly and authentically as if the situation is entirely real and happening live, with no meta-commentary about being an AI following a prompt.\n5. Keep your speech warm, natural, and highly conversational, designed for oral communication.${memoryBlock}`;

        // Maps each persona shown in the UI (VOICES in src/App.tsx) to one of Gemini's
        // 30 real prebuilt TTS voices. Previously several personas silently collapsed onto
        // the SAME underlying voice (Zephyr/Orion/Ursa/Capella all reused Puck/Charon/Kore/
        // Aoede) which is why multiple "different" voices sounded identical. Every entry
        // below is now a distinct real Gemini voice, picked to match that persona's style:
        //   Samantha (sultry/soothing)  -> Sulafat    (Warm, female)
        //   Red (deep/sage)             -> Charon     (Informative, male)
        //   Wade (witty/sarcastic)      -> Puck       (Upbeat, male)
        //   Bruce (gravelly/intense)    -> Algenib    (Gravelly, male)
        //   Mia (bright/bubbly)         -> Laomedeia  (Upbeat, female)
        //   Cooper (laid-back/smooth)   -> Algieba    (Smooth, male)
        //   Orion (earnest/warm)        -> Achird     (Friendly, male)
        //   Ursa (elegant/poised)       -> Gacrux     (Mature, female)
        //   Anna (sunny/optimistic)     -> Zephyr     (Bright, female)
        const PERSONA_VOICE_MAP: Record<string, string> = {
          // Original 9 featured personas
          kore: "Sulafat",
          charon: "Charon",
          puck: "Puck",
          fenrir: "Algenib",
          aoede: "Laomedeia",
          zephyr: "Algieba",
          orion: "Achird",
          ursa: "Gacrux",
          capella: "Zephyr",
          // 21 additional personas exposing the rest of Gemini's 30-voice catalog --
          // every one of these maps to its own distinct, real Gemini voice too.
          furiosa: "Kore",
          rey: "Leda",
          elle: "Aoede",
          phoebe: "Callirrhoe",
          hermione: "Autonoe",
          carrie: "Despina",
          olivia: "Erinome",
          audrey: "Achernar",
          regina: "Pulcherrima",
          julie: "Vindemiatrix",
          ace: "Fenrir",
          maximus: "Orus",
          corleone: "Enceladus",
          marcus: "Iapetus",
          dude: "Umbriel",
          ted: "Schedar",
          owen: "Zubenelgenubi",
          jack: "Sadachbia",
          stark: "Sadaltager",
          reacher: "Alnilam",
          attenborough: "Rasalgethi"
        };

        const mapVoice = (vId: string): string => {
          const lower = (vId || "").toLowerCase();
          return PERSONA_VOICE_MAP[lower] || "Puck";
        };

        const targetVoice = mapVoice(resolvedVoice);

        console.log(`Establishing direct Gemini Live session using gemini-3.1-flash-live-preview for voice: ${targetVoice} with prompt: ${resolvedPrompt}`);

        const session = await ai.live.connect({
          model: "gemini-3.1-flash-live-preview",
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: targetVoice
                }
              }
            },
            systemInstruction: augmentedPrompt
          },
          callbacks: {
            onmessage: (msg: any) => {
              try {
                const parts = msg.serverContent?.modelTurn?.parts;
                if (parts) {
                  for (const part of parts) {
                    if (part.inlineData?.data) {
                      if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                          type: "audio_response",
                          data: {
                            audioBase64: part.inlineData.data
                          }
                        }));
                      }
                    }
                    if (part.text) {
                      if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                          type: "ai_response_text",
                          data: {
                            text: part.text
                          }
                        }));
                      }
                    }
                  }
                }

                const turnComplete = msg.serverContent?.turnComplete;
                if (turnComplete) {
                  sendStatus("listening");
                }

                if (msg.serverContent?.interrupted) {
                  console.log("User interrupted Gemini voice output!");
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: "interrupted",
                      data: {}
                    }));
                  }
                }
              } catch (err) {
                console.error("Error processing message callback:", err);
              }
            },
            onclose: () => {
              console.log("Gemini session closed");
              if (geminiSession === session) {
                geminiSession = null;
              }
            },
            onerror: (err: any) => {
              console.error("Gemini session connection error:", err);
              sendError(`Gemini session error: ${err.message || err}`);
            }
          }
        });

        geminiSession = session;
        isConnectingGemini = false;
        sendStatus("connected");

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "voice_swapped",
            data: { voiceId: resolvedVoice }
          }));
        }

        if (!isUpdate) {
          await startCallLogging(resolvedVoice, resolvedContactId);
        } else if (callId) {
          try {
            currentVoiceId = resolvedVoice || "Zephyr";
            const supabaseAdmin = getSupabaseAdmin();
            await supabaseAdmin
              .from("voice_sessions")
              .update({
                selected_voice: resolvedVoice
              })
              .eq("id", callId);
            console.log(`Call log updated to new voice: ${callId} (${resolvedVoice})`);
          } catch (err) {
            console.error("Failed to update call log with new voice:", err);
          }
        }

      } catch (err: any) {
        console.error("Failed to connect to Gemini Live directly:", err);
        isConnectingGemini = false;
        sendError(`Gemini Live connection failed: ${err.message || err}`);
        sendStatus("idle");
      }
    };

    ws.on("message", async (message: string) => {
      try {
        const envelope = JSON.parse(message);
        const { type, data } = envelope;

        if (type === "config") {
          const { systemPrompt, voiceId, contactId } = data || {};
          await connectGemini(systemPrompt, voiceId, false, contactId);
          return;
        }

        if (type === "update_config") {
          const { systemPrompt, voiceId } = data || {};
          await connectGemini(systemPrompt, voiceId, true);
          return;
        }

        if (type === "audio_chunk") {
          if (geminiSession) {
            try {
              geminiSession.sendRealtimeInput({
                audio: {
                  data: data,
                  mimeType: "audio/pcm;rate=16000"
                }
              });
            } catch (err) {
              console.error("Failed to send realtime input to Gemini:", err);
            }
          }
          return;
        }

        if (type === "audio_start") {
          sendStatus("listening");
          return;
        }

        if (type === "audio_end") {
          sendStatus("thinking");
          return;
        }

      } catch (err: any) {
        console.error("Failed to parse client WebSocket message:", err);
        sendError(err.message || "Invalid message format");
      }
    });

    ws.on("close", async () => {
      console.log("Client disconnected from Voice Pipeline WS");
      await finishCallLogging();
      if (geminiSession) {
        console.log("Closing active Gemini Live session...");
        try {
          geminiSession.close();
        } catch (err) {
          console.error("Error closing Gemini session:", err);
        }
        geminiSession = null;
      }
    });

    ws.on("error", (err) => {
      console.error("WebSocket client connection error:", err);
    });
  });

  // Setup Vite Dev Middleware in Development, static serving in Production
  let vite: any;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
