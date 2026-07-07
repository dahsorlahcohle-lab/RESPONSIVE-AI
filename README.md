# RESPONSIVE AI 🎙️

A production-ready, full-stack application featuring a real-time, ultra-low-latency voice conversation pipeline. Built with React (Vite) on the frontend, an Express server with a WebSocket bridge on the backend, and powered directly by Google's **Gemini Live API** via the modern `@google/genai` SDK.

---

## 🚀 Architectural Overview

RESPONSIVE AI establishes a seamless, full-duplex voice pipeline that converts client-side microphone input into real-time spoken responses from Gemini:

```
[User Mic] ---> 16kHz PCM Audio Chunks ---> [Browser WS Client]
                                                      |
                                               Secure WS Upgrade
                                                      v
[Gemini Live API] <--- Bi-Directional WS Stream <--- [Express Server]
        |
   Real-Time Voice
        v
[Express Server] ---> 24kHz Int16 Audio Chunks ---> [Browser Audio Queue] ---> [User Speaker]
```

### Key Modules:
- **Client App (`src/App.tsx`)**: Responsive, interactive UI with voice selectors, a live telemetry/developer logging console, active call monitoring, and account management.
- **Microphone Capture Hook (`src/hooks/useMicrophone.ts`)**: Requests microphone permissions and records raw mono PCM audio at 16kHz. Converts samples to Base64 to transmit over WebSockets.
- **Audio Playback Hook (`src/hooks/useAudioPlayback.ts`)**: Decodes 24kHz output chunks from Gemini, schedules sequential playtimes with lookahead buffering to prevent pops/jitter, and handles **user barge-in (interruption)** instantly.
- **Backend WS Server (`server.ts`)**: Authorizes incoming WebSocket upgrades using Firebase Auth, initializes the Gemini Live API connection, and bridges audio streams in real time.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Motion (Animations), Lucide React (Icons).
- **Backend**: Node.js, Express, `ws` (WebSockets), `tsx` (TypeScript Executor).
- **AI Engine**: `@google/genai` SDK (`gemini-3.1-flash-live-preview`).
- **Database & Auth**: Firebase Admin SDK & client SDK (transitioning to Supabase).

---

## ⚙️ Local Development Setup

### 1. Prerequisites
- **Node.js** v18 or newer
- **npm** (comes with Node.js)

### 2. Installation
Clone the repository and install all dependencies:
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory and define the following variables:
```env
# Gemini API Key (obtain from Google AI Studio / Secrets)
GEMINI_API_KEY="your-gemini-api-key"

# App URL for OAuth or Self-Referencing
APP_URL="http://localhost:3000"

# Firebase Credentials (if using Firebase)
# (Auto-loaded in production; configure client/server config fields accordingly)
```

### 4. Running the Application

- **Development Mode** (with hot reloading and dev tooling):
  ```bash
  npm run dev
  ```
  The application will be accessible at [http://localhost:3000](http://localhost:3000).

- **Production Build & Start**:
  ```bash
  npm run build
  npm start
  ```

---

## 💻 Professional Development Workflow

### Git & Collaboration
We use a standard Git branch workflow for all feature developments and releases:

```bash
# Create and switch to a feature branch
git checkout -b feature/supabase-migration

# Stage changes
git add .

# Commit with descriptive messages
git commit -m "feat: integrate Supabase client and auth logic"

# Push branch to GitHub
git push origin feature/supabase-migration
```

### Supabase Integration (Planned)
To move from Firebase to Supabase for a unified database & auth workspace, the following components will be updated:
1. **Authentication**: Use `@supabase/supabase-js` for user signup, login, and secure JWT verification on WebSocket upgrade requests.
2. **Database (PostgreSQL)**: Save voice call analytics, duration stats, and audit logs inside a PostgreSQL relational database.
3. **Storage**: Save call recordings and user profile avatars in Supabase Storage.

---

## 🔍 Diagnostics & Debugging

If you encounter issues establishing a call session:
1. Check that your browser has granted **microphone permissions**.
2. Verify that **`GEMINI_API_KEY`** is loaded correctly in your environment variables.
3. Open the **Developer Console** in the app's UI to view live packet transmissions and pipeline statuses.
