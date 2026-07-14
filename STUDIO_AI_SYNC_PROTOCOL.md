# RESPONXIVE — Studio AI Sync Protocol
> Copy this prompt in full to Studio AI before making any changes to the project.

---

## 0. PULL FIRST — ALWAYS

```
git pull origin main
```

Do this before touching a single file. Never force-push. Never rebase shared history.
If you have local uncommitted changes, stash them first (`git stash`), pull, then reapply.

---

## 1. PROJECT IDENTITY

| Field | Value |
|---|---|
| **App name** | RESPONXIVE |
| **GitHub repo** | `dahsorlahcohle-lab/RESPONSIVE-AI` (branch: `main`) |
| **Runtime** | Node 18 + Vite (React/TypeScript) |
| **Backend** | `server.ts` — Express + WebSocket + Gemini Live API |
| **Primary DB** | Supabase (Postgres) |
| **Fallback DB** | Firestore (via `src/lib/db-fallback.ts`) |
| **File storage** | Supabase Storage (bucket: `call-context`) |
| **Auth** | Supabase Auth (JWT, `mailer_autoconfirm = true`) |
| **AI** | Gemini Live API (`gemini-2.0-flash-live-preview`) |

---

## 2. SEPARATION OF RESPONSIBILITIES

### 2A. GITHUB OWNS → All source code and configuration

Push to GitHub whenever any of these change:

| Category | Files |
|---|---|
| Frontend | `src/**/*.tsx`, `src/**/*.ts`, `src/index.css` |
| Backend | `server.ts` |
| Data layer | `src/lib/db-fallback.ts`, `src/lib/supabase.ts`, `src/lib/supabase-admin.ts`, `src/lib/firebase.ts`, `src/lib/firebase-admin.ts`, `src/lib/firebase-rest.ts` |
| Build config | `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json` |
| Static assets | `public/logo.png`, `index.html` |
| DB schema docs | `supabase/migrations/*.sql` (documentation only — NOT auto-applied) |
| Project config | `firebase-applet-config.json`, `firestore.rules`, `metadata.json` |

**Never commit to GitHub:**
- `.env`, `.env.local`, or any file containing secrets
- `node_modules/`
- `dist/` (build output)
- Any file containing `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, or `FIREBASE_*` credentials

---

### 2B. SUPABASE OWNS → All live data, schema, auth, and file storage

Supabase is the source of truth for everything runtime. GitHub only stores migration SQL as documentation — it does NOT auto-run migrations.

#### Database Tables (Postgres, schema: `public`)

| Table | Purpose | Primary Key |
|---|---|---|
| `users` | App user profiles (email, full_name, role, status) | `id` (= Supabase Auth UID) |
| `contacts` | Legacy contact records per user | `id` (uuid) |
| `user_preferences` | Saved voice, persona, speed per user | `user_id` (FK → users) |
| `call_sessions` | Every call record (duration, contact, personality) | `id` (uuid) |
| `transcript_messages` | Per-turn call transcripts (speaker, text, timestamp) | `id` (uuid) |
| `personalities` | User-defined AI personality profiles | `id` (uuid) |

#### How to apply schema changes
1. Write the SQL in `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Commit it to GitHub (documentation trail)
3. Execute it against the live DB using the **Supabase Management API** or the Supabase SQL editor directly
4. **Never use `supabase db push` or CLI migrations** — the project does not use the Supabase CLI

#### Row-Level Security (RLS)
- RLS is enabled on all tables
- Users can only read/write their own rows (`auth.uid() = user_id`)
- The backend (`server.ts`) uses the service role key to bypass RLS when needed
- Never disable RLS on any table

#### Auth rules
- `mailer_autoconfirm = true` — **never change this**; it bypasses email confirmation to avoid SMTP rate limits
- Auth provider: Email/Password only (no OAuth providers enabled)
- Session tokens: JWT, verified server-side via `supabase.auth.getUser(token)` in `server.ts`

#### Storage
- Bucket name: `call-context` (private, 10 MB max file size)
- The bucket is auto-created on server startup if missing (idempotent)
- Upload path pattern: `{user_uid}/call-context/{timestamp}-{filename}`
- Supported file types: PDF, TXT, DOC, DOCX
- Files are read server-side, parsed, and injected as live directives into the active Gemini session
- **Never move file upload logic to the client side**

---

## 3. DATA FLOW — WHO WRITES WHAT

```
User action (browser)
  │
  ▼
src/App.tsx (React frontend)
  │  WebSocket or REST fetch
  ▼
server.ts (Express + WS backend)
  │
  ├─► Supabase DB (primary)  ←── ALL persistent data lives here
  │       users, contacts, user_preferences,
  │       call_sessions, transcript_messages, personalities
  │
  ├─► Supabase Storage       ←── ALL uploaded files live here
  │       bucket: call-context
  │
  ├─► Firestore (fallback)   ←── Only if Supabase fails (db-fallback.ts)
  │       Same schema, same data, emergency only
  │
  └─► Gemini Live API        ←── Real-time audio + transcription
          inputAudioTranscription + outputAudioTranscription enabled
          Transcripts saved server-side in finishCallLogging()
```

---

## 4. TRANSCRIPT & CALL LOGGING RULES

- **All transcript saving is server-side only** — no client-side Web Speech API, no browser recording
- Gemini native `inputAudioTranscription` and `outputAudioTranscription` are enabled in the session config
- Text is accumulated server-side in `pendingUserText` / `pendingAiText`, flushed on speaker transitions and `turnComplete`
- `finishCallLogging()` is called on WebSocket `close` — it saves to `call_sessions` and `transcript_messages`
- Calls saved before commit `991c2b0` have empty transcripts permanently — this is expected, do not try to backfill

---

## 5. PERSONALITY SYSTEM (replaces legacy Contacts)

- Table: `personalities` (id, user_id, name, role, communication_style, knowledge_area, behavior_pattern, created_at)
- REST routes in `server.ts`:
  - `GET /api/personalities` — list for current user
  - `POST /api/personalities` — create new
  - `PUT /api/personalities/:id` — update
  - `DELETE /api/personalities/:id` — delete
- Frontend CRUD lives in `src/components/SidebarPanel.tsx` (Personality tab)
- When a call starts, `personalityId` is sent in the WS config payload → `connectGemini()` builds the system prompt from the saved Personality profile
- **Never restore the legacy Contact Directory** — it has been permanently replaced by the Personality system

---

## 6. VOICE SYSTEM

- 30 distinct Gemini Live voices, each mapped to a unique persona
- `VOICES` array lives in `src/App.tsx`
- `PERSONA_VOICE_MAP` lives in `server.ts` — maps persona IDs to real Gemini voice names
- `ACCENT_MAPPING` lives in `src/components/VoiceSelectionModal.tsx`
- All 30 voices must remain intact — never reduce this list
- Voice selection UI lives in the Sidebar `Voice` tab (`src/components/SidebarPanel.tsx`)
- ElevenLabs is NOT integrated — do not add it; it would break the real-time duplex pipeline

---

## 7. UI LAYOUT RULES (do not break)

### Header
```
[ shield logo /logo.png — far left, h-9 ] [ RESPONXIVE — absolutely centered ] [ ••• — far right ]
```
- No profile/user icon in the header
- Logo: `public/logo.png`, transparent background, original purple/silver colors, never replace

### Home Screen (top → bottom)
```
[ Header ]
[ Scrollable chat feed — past call turns ]
[ AI CORE PANEL — pinned, shows active personality + attributes ]
[ Typing bar — textarea + Send + Call button ]
```
- No greeting/welcome message
- No settings UI on the home screen
- AI Core panel is always visible above the typing bar

### Sidebar (right slide-in — `src/components/SidebarPanel.tsx`)
```
Tabs: Voice | Personality | Recent
Footer: [ 👤 My Profile ] [ ⚙ System Settings ]
```
- Slides in from the right when ••• is tapped
- Profile opens `UserProfileModal`
- Settings opens `ThreeDotMenuModal` on the settings tab

### Live Call Screen
- Shows active personality name at top
- Controls: Mute | Voice switch | File upload | End call
- Persistent typing bar for mid-call directives (injected via `sendClientContent()` — no reconnect)

---

## 8. ENVIRONMENT VARIABLES

These live in the server environment (Cloud Run / `.env`) — **never hardcode, never commit**:

| Variable | Used by |
|---|---|
| `SUPABASE_URL` | All Supabase operations |
| `SUPABASE_ANON_KEY` | Client-side Supabase auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin operations (bypasses RLS) |
| `GEMINI_API_KEY` | Gemini Live API |
| `FIREBASE_PROJECT_ID` | Firestore fallback |
| `FIREBASE_CLIENT_EMAIL` | Firestore fallback |
| `FIREBASE_PRIVATE_KEY` | Firestore fallback |
| `PORT` | Express server port (default 8080) |

---

## 9. GIT COMMIT PROTOCOL

Every commit must:
1. Pass `npx tsc --noEmit` — zero TypeScript errors
2. Pass `npx vite build` — clean production build
3. Use a descriptive prefix: `feat:`, `fix:`, `refactor:`, `chore:`
4. Push to `main` — there are no feature branches in this project

Never:
- Force-push (`git push --force`)
- Rebase shared history
- Commit `node_modules/`, `dist/`, or any `.env` file
- Push a build that fails type-check

---

## 10. WHAT NOT TO DO — PERMANENT RULES

| ❌ Never do this | ✅ Do this instead |
|---|---|
| Add a Contact Directory anywhere | Use the Personality system in the Sidebar |
| Add the User/profile icon to the header | Profile lives in Sidebar footer only |
| Add a welcome/greeting message to the home screen | Leave the chat feed clean |
| Move transcript saving to the client | All transcript logic stays in `server.ts` |
| Use the Supabase CLI for migrations | Use the Supabase Management API or SQL editor |
| Add ElevenLabs TTS | Use the existing 30 Gemini Live voices |
| Change `mailer_autoconfirm` to false | Leave it as true |
| Disable RLS on any Supabase table | Write proper RLS policies instead |
| Hardcode API keys in source code | Use environment variables |
| Force-push to GitHub | Always use standard `git push` |

---

## 11. CURRENT LATEST STATE

| Item | Value |
|---|---|
| Latest commit | `e198c4d` |
| Latest commit message | `feat: rebrand to RESPONXIVE + shield logo in header` |
| Supabase migrations applied | 4 (see `supabase/migrations/`) |
| Active Supabase tables | users, contacts, user_preferences, call_sessions, transcript_messages, personalities |
| Active Storage bucket | call-context |
| Voice count | 30 |
| Auth | Supabase Email/Password, autoconfirm ON |
