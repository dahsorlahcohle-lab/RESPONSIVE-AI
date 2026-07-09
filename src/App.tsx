import { useEffect, useRef, useState, useCallback } from "react";
import { useMicrophone } from "./hooks/useMicrophone";
import { useAudioPlayback } from "./hooks/useAudioPlayback";
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Activity, 
  Settings, 
  Terminal, 
  Wifi, 
  WifiOff, 
  Sparkles,
  Info,
  ChevronRight,
  User,
  Cpu,
  Layers,
  Lock,
  LogOut,
  ShieldCheck,
  LayoutDashboard,
  RefreshCw,
  History
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getSupabase } from "./lib/supabase";
import AuthScreen from "./components/AuthScreen";
import UserProfileModal from "./components/UserProfileModal";
import AdminConsole from "./components/AdminConsole";
import CallHistoryDrawer from "./components/CallHistoryDrawer";
import CallTopicPanel from "./components/CallTopicPanel";
import VoiceSelectionModal from "./components/VoiceSelectionModal";
import ThreeDotMenuModal, { AI_PERSONAS } from "./components/ThreeDotMenuModal";
import CallContactSelectorModal from "./components/CallContactSelectorModal";

interface LogMessage {
  id: string;
  timestamp: string;
  type: "in" | "out" | "system";
  event: string;
  payload: any;
}

interface ChatTurn {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  actor: string;
  gender: "Male" | "Female";
  description: string;
  movieReference: string;
  style: string;
  avatarBg: string;
  samplePhrase: string;
}

export const VOICES: VoiceOption[] = [
  {
    id: "Kore",
    name: "Samantha",
    actor: "Scarlett Johansson",
    gender: "Female",
    description: "Intimate, deeply empathetic, and soothing. Ready to connect as a warm intellectual companion.",
    movieReference: "Her (2013)",
    style: "Sultry & Soothing",
    avatarBg: "from-rose-500 via-pink-500 to-rose-400",
    samplePhrase: "I'm right here with you. Tell me, what's on your mind today?"
  },
  {
    id: "Charon",
    name: "Red",
    actor: "Morgan Freeman",
    gender: "Male",
    description: "Resonant, deep, and beautifully paced. Carries comforting narrative wisdom and a warm soul.",
    movieReference: "The Shawshank Redemption",
    style: "Deep & Sage",
    avatarBg: "from-amber-600 via-amber-500 to-yellow-500",
    samplePhrase: "Hope is a good thing, maybe the best of things, and no good thing ever dies."
  },
  {
    id: "Puck",
    name: "Wade",
    actor: "Ryan Reynolds",
    gender: "Male",
    description: "Highly energetic, quick-witted, and delightfully sarcastic. Fast-paced banter guaranteed.",
    movieReference: "Deadpool",
    style: "Witty & Sarcastic",
    avatarBg: "from-red-600 via-red-500 to-orange-500",
    samplePhrase: "Maximum effort! What kind of crazy trouble are we getting into today?"
  },
  {
    id: "Fenrir",
    name: "Bruce",
    actor: "Christian Bale",
    gender: "Male",
    description: "Gravelly, intense, and commanding. Speak with the dark knight's determination and serious grit.",
    movieReference: "The Dark Knight",
    style: "Gravelly & Intense",
    avatarBg: "from-slate-700 via-zinc-800 to-zinc-900",
    samplePhrase: "It's not who I am underneath, but what I do that defines me."
  },
  {
    id: "Aoede",
    name: "Mia",
    actor: "Emma Stone",
    gender: "Female",
    description: "Expressive, bright, bubbly, and quick on her feet. Bursting with passion and friendly charm.",
    movieReference: "La La Land",
    style: "Bright & Bubbly",
    avatarBg: "from-purple-500 via-fuchsia-500 to-fuchsia-400",
    samplePhrase: "Here's to the fools who dream, crazy as they may seem!"
  },
  {
    id: "Zephyr",
    name: "Cooper",
    actor: "Matthew McConaughey",
    gender: "Male",
    description: "Cool, relaxed, drawing out thoughts with absolute confidence and down-to-earth wisdom.",
    movieReference: "Interstellar",
    style: "Laid-back & Smooth",
    avatarBg: "from-indigo-500 via-blue-500 to-sky-400",
    samplePhrase: "Alright, alright, alright. Let's see what we can figure out together."
  },
  {
    id: "Orion",
    name: "Woody",
    actor: "Tom Hanks",
    gender: "Male",
    description: "Earnest, reliable, warm, and comforting. The ultimate trustworthy conversationalist.",
    movieReference: "Toy Story / Gump",
    style: "Earnest & Warm",
    avatarBg: "from-teal-600 via-teal-500 to-cyan-500",
    samplePhrase: "You've got a friend in me. I'm always here to listen."
  },
  {
    id: "Ursa",
    name: "Miranda",
    actor: "Meryl Streep",
    gender: "Female",
    description: "Highly articulate, sophisticated, composed, and maternal. Exudes noble poise and high intelligence.",
    movieReference: "The Devil Wears Prada",
    style: "Elegant & Poised",
    avatarBg: "from-violet-600 via-violet-500 to-indigo-500",
    samplePhrase: "Details matter. Tell me your thoughts, and let's refine them."
  },
  {
    id: "Capella",
    name: "Anna",
    actor: "Kristen Bell",
    gender: "Female",
    description: "Bursting with sunny optimism, cheerful empathy, and bright, encouraging energy.",
    movieReference: "Frozen / Good Place",
    style: "Sunny & Optimistic",
    avatarBg: "from-cyan-500 via-teal-400 to-emerald-400",
    samplePhrase: "Oh, this is going to be so much fun! What should we tackle first?"
  },
  {
    id: "Furiosa",
    name: "Furiosa",
    actor: "Charlize Theron",
    gender: "Female",
    description: "Steely, hardened, and unshakably resolute. Speaks with the authority of someone who's survived worse than this.",
    movieReference: "Mad Max: Fury Road",
    style: "Firm & Resolute",
    avatarBg: "from-orange-700 via-red-600 to-amber-600",
    samplePhrase: "We are not going back. Redemption is possible -- hope is not lost."
  },
  {
    id: "Rey",
    name: "Rey",
    actor: "Daisy Ridley",
    gender: "Female",
    description: "Bright, eager, and full of scrappy determination. Sounds ready to take on the galaxy before breakfast.",
    movieReference: "Star Wars: The Force Awakens",
    style: "Youthful & Spirited",
    avatarBg: "from-yellow-400 via-amber-300 to-orange-300",
    samplePhrase: "I know what I have to do. Let's just get on with it, then."
  },
  {
    id: "Elle",
    name: "Elle",
    actor: "Reese Witherspoon",
    gender: "Female",
    description: "Light, quick, and disarmingly upbeat. Turns even a tough conversation into something fun.",
    movieReference: "Legally Blonde",
    style: "Breezy & Effervescent",
    avatarBg: "from-pink-400 via-fuchsia-300 to-pink-300",
    samplePhrase: "What, like it's hard? Let's figure this out together!"
  },
  {
    id: "Phoebe",
    name: "Phoebe",
    actor: "Lisa Kudrow",
    gender: "Female",
    description: "Relaxed, whimsical, and delightfully unbothered by life's chaos. Takes everything in stride with a smile.",
    movieReference: "Friends",
    style: "Easy-going & Quirky",
    avatarBg: "from-lime-400 via-green-300 to-emerald-300",
    samplePhrase: "Oh, I don't judge. I mean, I do, but not out loud... okay, sometimes out loud."
  },
  {
    id: "Hermione",
    name: "Hermione",
    actor: "Emma Watson",
    gender: "Female",
    description: "Quick, articulate, and dazzlingly switched-on. Always three steps ahead and happy to prove it.",
    movieReference: "Harry Potter",
    style: "Bright & Sharp",
    avatarBg: "from-red-700 via-yellow-600 to-red-600",
    samplePhrase: "Honestly, if you'd just read the material, this would go a lot faster."
  },
  {
    id: "Carrie",
    name: "Carrie",
    actor: "Sarah Jessica Parker",
    gender: "Female",
    description: "Silky, easy-flowing, and effortlessly conversational. Makes small talk feel like a story worth telling.",
    movieReference: "Sex and the City",
    style: "Smooth & Chatty",
    avatarBg: "from-fuchsia-600 via-pink-500 to-rose-400",
    samplePhrase: "I couldn't help but wonder... what exactly are we getting into today?"
  },
  {
    id: "Olivia",
    name: "Olivia",
    actor: "Kerry Washington",
    gender: "Female",
    description: "Crisp, articulate, and always in control of the message. Every word lands exactly where it's meant to.",
    movieReference: "Scandal",
    style: "Clear & Precise",
    avatarBg: "from-sky-600 via-blue-500 to-indigo-500",
    samplePhrase: "Let's handle this. Walk me through it, precisely, from the top."
  },
  {
    id: "Audrey",
    name: "Audrey",
    actor: "Audrey Hepburn",
    gender: "Female",
    description: "Delicate, gentle, and quietly elegant. Speaks like every word was chosen with care.",
    movieReference: "Roman Holiday",
    style: "Soft & Graceful",
    avatarBg: "from-stone-300 via-neutral-200 to-stone-200",
    samplePhrase: "It's such a lovely day. I don't want to rush a single moment of it."
  },
  {
    id: "Regina",
    name: "Regina",
    actor: "Rachel McAdams",
    gender: "Female",
    description: "Blunt, confident, and impossible to ignore. Says exactly what she means, no hedging.",
    movieReference: "Mean Girls",
    style: "Bold & Direct",
    avatarBg: "from-pink-600 via-rose-500 to-red-500",
    samplePhrase: "Get in. We're doing this now, and we're doing it my way."
  },
  {
    id: "Julie",
    name: "Julie",
    actor: "Julie Andrews",
    gender: "Female",
    description: "Tender, soothing, and endlessly patient. The kind of voice that makes everything feel like it'll be alright.",
    movieReference: "Mary Poppins",
    style: "Gentle & Nurturing",
    avatarBg: "from-sky-300 via-blue-200 to-cyan-200",
    samplePhrase: "In every job that must be done, there is an element of fun. Shall we begin?"
  },
  {
    id: "Ace",
    name: "Ace",
    actor: "Jim Carrey",
    gender: "Male",
    description: "Loud, wild, and bursting with unpredictable energy. Never met a moment he couldn't turn up to eleven.",
    movieReference: "Ace Ventura",
    style: "Excitable & Manic",
    avatarBg: "from-lime-500 via-yellow-400 to-orange-400",
    samplePhrase: "Alrighty then! Let's dive in -- this is gonna be great, I can feel it!"
  },
  {
    id: "Maximus",
    name: "Maximus",
    actor: "Russell Crowe",
    gender: "Male",
    description: "Grounded, disciplined, and unwavering. Speaks with the calm authority of someone used to being obeyed.",
    movieReference: "Gladiator",
    style: "Firm & Commanding",
    avatarBg: "from-stone-600 via-amber-700 to-yellow-700",
    samplePhrase: "What we do in this call echoes. Let's get it right."
  },
  {
    id: "Corleone",
    name: "Corleone",
    actor: "Marlon Brando",
    gender: "Male",
    description: "Low, breathy, and deliberately unhurried. Every sentence sounds like it carries weight.",
    movieReference: "The Godfather",
    style: "Breathy & Hushed",
    avatarBg: "from-zinc-800 via-stone-900 to-neutral-800",
    samplePhrase: "I'm gonna make you an offer... you'll want to hear this one out."
  },
  {
    id: "Marcus",
    name: "Marcus",
    actor: "Denzel Washington",
    gender: "Male",
    description: "Crisp, deliberate, and impossible to mishear. Every word is enunciated like it matters.",
    movieReference: "Malcolm X",
    style: "Clear & Commanding",
    avatarBg: "from-blue-700 via-indigo-600 to-blue-600",
    samplePhrase: "Let's be clear about what we're doing here, and why it matters."
  },
  {
    id: "Dude",
    name: "Dude",
    actor: "Jeff Bridges",
    gender: "Male",
    description: "Chill, unhurried, and impossible to rattle. Takes whatever comes with a shrug and a smile.",
    movieReference: "The Big Lebowski",
    style: "Easy-going & Unbothered",
    avatarBg: "from-amber-400 via-yellow-300 to-lime-300",
    samplePhrase: "Yeah, well, that's just, like, your opinion, man. Let's roll with it though."
  },
  {
    id: "Ted",
    name: "Ted",
    actor: "Jason Sudeikis",
    gender: "Male",
    description: "Balanced, level, and relentlessly even-keeled. Nothing knocks him off his stride.",
    movieReference: "Ted Lasso",
    style: "Even & Steady",
    avatarBg: "from-orange-400 via-amber-300 to-yellow-300",
    samplePhrase: "You know what the happiest animal on earth is? A goldfish. Let's just take it one step at a time."
  },
  {
    id: "Owen",
    name: "Owen",
    actor: "Owen Wilson",
    gender: "Male",
    description: "Relaxed, conversational, zero pretense. Talks to you like you've been friends for years.",
    movieReference: "Wedding Crashers",
    style: "Casual & Breezy",
    avatarBg: "from-cyan-400 via-sky-300 to-blue-300",
    samplePhrase: "Wow. Okay, that's... yeah, no, that's great, actually. Let's do this."
  },
  {
    id: "Jack",
    name: "Jack",
    actor: "Johnny Depp",
    gender: "Male",
    description: "Animated, quick, and a little unpredictable. Every line lands with a wink and a flourish.",
    movieReference: "Pirates of the Caribbean",
    style: "Lively & Theatrical",
    avatarBg: "from-amber-700 via-orange-600 to-red-600",
    samplePhrase: "Why is the rum always gone? No matter -- onward, savvy?"
  },
  {
    id: "Stark",
    name: "Stark",
    actor: "Robert Downey Jr.",
    gender: "Male",
    description: "Quick-thinking, technically sharp, and effortlessly well-informed. Explains complex things like they're obvious.",
    movieReference: "Iron Man",
    style: "Sharp & Knowledgeable",
    avatarBg: "from-red-600 via-orange-500 to-yellow-500",
    samplePhrase: "Follow me here -- it's actually simpler than it sounds, I promise."
  },
  {
    id: "Reacher",
    name: "Reacher",
    actor: "Arnold Schwarzenegger",
    gender: "Male",
    description: "Short, direct, and completely unshakeable. Doesn't waste words, doesn't repeat himself twice.",
    movieReference: "The Terminator",
    style: "Firm & Blunt",
    avatarBg: "from-neutral-700 via-zinc-600 to-slate-600",
    samplePhrase: "I'll be back -- with an answer. Give me a second."
  },
  {
    id: "Attenborough",
    name: "Attenborough",
    actor: "David Attenborough",
    gender: "Male",
    description: "Measured, documentary-calm, and quietly fascinated by everything. Narrates even small talk like a nature special.",
    movieReference: "Planet Earth",
    style: "Informative & Measured",
    avatarBg: "from-emerald-700 via-teal-600 to-cyan-600",
    samplePhrase: "And here, we observe something truly remarkable unfolding before us."
  }
];

export default function App() {
  // Authentication & Profile States
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("user");
  const [userStatus, setUserStatus] = useState<string>("active");
  const [authToken, setAuthToken] = useState<string>("");
  const [authLoading, setAuthLoading] = useState(true);

  // Profile and Admin overlay states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAdminConsole, setShowAdminConsole] = useState(false);

  // Router States for secure /admin access
  const [currentRoute, setCurrentRoute] = useState<"home" | "admin">(
    window.location.pathname === "/admin" || window.location.hash === "#admin" ? "admin" : "home"
  );

  useEffect(() => {
    const handleUrlChange = () => {
      const isAd = window.location.pathname === "/admin" || window.location.hash === "#admin";
      setCurrentRoute(isAd ? "admin" : "home");
    };
    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("hashchange", handleUrlChange);
    return () => {
      window.removeEventListener("popstate", handleUrlChange);
      window.removeEventListener("hashchange", handleUrlChange);
    };
  }, []);

  const navigateTo = (route: "home" | "admin") => {
    if (route === "admin") {
      window.history.pushState({}, "", "/admin");
      setCurrentRoute("admin");
    } else {
      window.history.pushState({}, "", "/");
      setCurrentRoute("home");
    }
  };

  // Call Session States
  const [callState, setCallState] = useState<"idle" | "connecting" | "ringing" | "active" | "ended">("idle");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are an engaging phone partner. Keep your replies friendly, conversational, and concise. Ask questions to keep the flow alive!"
  );
  // What the user wants the AI to talk about -- editable before a call starts (folded
  // into the AI's instructions on connect) and during a live call (pushed straight into
  // the live Gemini session so it reacts to it immediately). Same value, two entry points.
  const [callTopic, setCallTopic] = useState("");
  const activeTopicRef = useRef(callTopic);
  const [selectedVoice, setSelectedVoice] = useState("Zephyr");
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSwappingVoice, setIsSwappingVoice] = useState(false);

  // Unified Three-Dot Control Hub States
  const [showThreeDotMenuModal, setShowThreeDotMenuModal] = useState(false);
  const [showCallContactSelectorModal, setShowCallContactSelectorModal] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState("friendly");

  const [liveDurationSeconds, setLiveDurationSeconds] = useState(0);
  useEffect(() => {
    let timer: any = null;
    if (callState === "active") {
      setLiveDurationSeconds(0);
      timer = setInterval(() => {
        setLiveDurationSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setLiveDurationSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  const formatLiveDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Call History, Contact Directory, and Active Call States
  const [calls, setCalls] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [activeCallSessionId, setActiveCallSessionId] = useState<string | null>(null);
  const callStartTimeRef = useRef<number>(Date.now());

  // Audio Pipeline States (idle | listening | thinking | speaking)
  const [pipelineState, setPipelineState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  
  // Dialog Conversation Logs
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [currentAiText, setCurrentAiText] = useState("");
  
  // Developer Packet Logs
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [filterType, setFilterType] = useState<"all" | "in" | "out" | "system">("all");
  const [showDevConsole, setShowDevConsole] = useState(false);

  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  const activePromptRef = useRef(systemPrompt);

  // Instantiating our sequential 24kHz Audio Playback hook
  const { playChunk, stopPlayback, isPlaying } = useAudioPlayback();

  // Listen to Supabase Authentication State Changes
  useEffect(() => {
    const supabase = getSupabase();

    const handleSession = async (session: any) => {
      if (session) {
        const currentUser = session.user;
        const mappedUser = {
          uid: currentUser.id,
          email: currentUser.email,
          displayName: currentUser.user_metadata?.displayName || currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0] || "User"
        };
        setUser(mappedUser);

        const token = session.access_token;
        if (token) {
          setAuthToken(token);
          
          try {
            // Sync profile with database on backend server securely
            const response = await fetch("/api/auth/register-profile", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              }
            });
            const data = await response.json();
            if (data.success) {
              setUserRole(data.role || "user");
              setUserStatus(data.status || "active");
            }
          } catch (err) {
            console.error("Failed to register/sync profile on server:", err);
          }
        }
      } else {
        setUser(null);
        setUserRole("user");
        setUserStatus("active");
        setAuthToken("");
      }
      setAuthLoading(false);
    };

    // Initialize session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      handleSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch calls and contacts
  const fetchCalls = useCallback(async () => {
    if (!authToken) return;
    try {
      const response = await fetch("/api/calls", {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (data.success) {
        setCalls(data.calls || []);
      }
    } catch (err) {
      console.error("Failed to fetch call history:", err);
    }
  }, [authToken]);

  const fetchContacts = useCallback(async () => {
    if (!authToken) return;
    try {
      const response = await fetch("/api/contacts", {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (data.success) {
        setContacts(data.contacts || []);
      }
    } catch (err) {
      console.error("Failed to fetch contacts:", err);
    }
  }, [authToken]);

  const fetchPreferences = useCallback(async () => {
    if (!authToken) return;
    try {
      const response = await fetch("/api/preferences", {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (data.success && data.preferences) {
        if (data.preferences.default_voice) {
          setSelectedVoice(data.preferences.default_voice);
        }
        if (data.preferences.ai_personality) {
          setSelectedPersona(data.preferences.ai_personality);
          const found = AI_PERSONAS.find(p => p.id === data.preferences.ai_personality);
          if (found) {
            setSystemPrompt(found.prompt);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch preferences:", err);
    }
  }, [authToken]);

  const handleSaveVoicePreference = async (voiceId: string) => {
    if (!authToken) return;
    try {
      const response = await fetch("/api/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ default_voice: voiceId })
      });
      const data = await response.json();
      if (data.success) {
        setSelectedVoice(voiceId);
        setShowVoiceModal(false);
      }
    } catch (err) {
      console.error("Failed to save voice preference:", err);
    }
  };

  const handleSavePersonaPreference = async (personaId: string) => {
    if (!authToken) return;
    try {
      const response = await fetch("/api/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ ai_personality: personaId })
      });
      const data = await response.json();
      if (data.success) {
        setSelectedPersona(personaId);
        const found = AI_PERSONAS.find(p => p.id === personaId);
        if (found) {
          setSystemPrompt(found.prompt);
        }
      }
    } catch (err) {
      console.error("Failed to save persona preference:", err);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchCalls();
      fetchContacts();
      fetchPreferences();
    }
  }, [authToken, fetchCalls, fetchContacts, fetchPreferences]);

  const handleCreateContact = async (name: string, company: string, phone: string, notes: string) => {
    if (!authToken) return;
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ name, company, phone, notes })
      });
      const data = await response.json();
      if (data.success) {
        await fetchContacts();
      }
    } catch (err) {
      console.error("Failed to create contact:", err);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!authToken) return;
    try {
      await fetch(`/api/contacts/${contactId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });
      setContacts((prev) => prev.filter(c => c.id !== contactId));
    } catch (err) {
      console.error("Failed to delete contact:", err);
    }
  };

  // Helper to push clean telemetry logs
  const addLog = useCallback((type: "in" | "out" | "system", event: string, payload: any) => {
    const newLog: LogMessage = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      event,
      payload,
    };
    setLogs((prev) => [newLog, ...prev].slice(0, 100));
  }, []);

  // Establish WebSocket connection & build Gemini Live Session
  const startCallSession = useCallback((overrideContactId?: string | null) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setCallState("connecting");
    setConnectionStatus("connecting");
    setIsSwappingVoice(false);
    setChatHistory([]);
    setCurrentAiText("");
    addLog("system", "ws_connecting", "Placing voice call to Gemini Live Node...");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Append the Firebase Auth Id Token to securely authorize the WebSocket Upgrade
    const wsUrl = `${protocol}//${window.location.host}/api/ws?token=${authToken}`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus("connected");
        setCallState("ringing");
        addLog("system", "ws_connected", `Call transport channel established: ${wsUrl}`);
        
        // Dispatch call setup and instructions envelope
        const targetContactId = overrideContactId !== undefined ? overrideContactId : selectedContactId;
        const setupPayload = {
          systemPrompt: activePromptRef.current,
          voiceId: selectedVoice,
          contactId: targetContactId,
          callTopic: activeTopicRef.current,
        };
        socket.send(JSON.stringify({ type: "config", data: setupPayload }));
        addLog("out", "config", setupPayload);
      };

      socket.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          const { type, data } = envelope;

          addLog("in", type, data);

          switch (type) {
            case "call_id": {
              if (data?.callId) {
                setActiveCallSessionId(data.callId);
                console.log("Registered active callId state:", data.callId);
              }
              if (data?.contactId) {
                setSelectedContactId(data.contactId);
                fetchContacts();
              }
              break;
            }
            case "status": {
              if (data?.state) {
                setPipelineState(data.state);
                if (data.state === "connected") {
                  setCallState("active");
                }
              }
              break;
            }
            case "audio_response": {
              if (data?.audioBase64) {
                playChunk(data.audioBase64, 0);
              }
              break;
            }
            case "ai_response_text": {
              if (data?.text) {
                setCurrentAiText((prev) => {
                  const updated = prev + data.text;
                  return updated;
                });
              }
              break;
            }
            case "voice_swapped": {
              addLog("system", "voice_swapped_confirm", `Voice successfully swapped to ${data.voiceId}`);
              setIsSwappingVoice(false);
              stopPlayback();
              setCurrentAiText("");
              break;
            }
            case "interrupted": {
              // User barge-in! Mute playback instantly
              stopPlayback();
              addLog("system", "barge_in_interruption", "AI model response interrupted by user input.");
              break;
            }
            case "error": {
              addLog("system", "pipeline_error", data.message);
              setCallState("ended");
              setIsSwappingVoice(false);
              break;
            }
          }
        } catch (err: any) {
          console.error("Error reading socket package:", err);
        }
      };

      socket.onclose = (ev) => {
        setConnectionStatus("disconnected");
        setPipelineState("idle");
        setCallState("idle");
        setIsSwappingVoice(false);
        addLog("system", "ws_disconnected", `Call terminated: code=${ev.code}`);
      };

      socket.onerror = (err) => {
        addLog("system", "ws_error", "WebSocket transmission error");
        console.error("WebSocket transport error:", err);
        setIsSwappingVoice(false);
      };
    } catch (err: any) {
      setConnectionStatus("disconnected");
      setCallState("idle");
      setIsSwappingVoice(false);
      addLog("system", "ws_init_error", err.message || "Failed to initialize call bridge");
    }
  }, [selectedVoice, addLog, playChunk, stopPlayback, authToken, fetchContacts, selectedContactId]);

  // Handle active stream from microphone
  const handleMicrophoneChunk = useCallback((base64: string) => {
    if (isMuted) return; // ignore chunk if microphone is physically muted by user
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const chunkMsg = { type: "audio_chunk", data: base64 };
      wsRef.current.send(JSON.stringify(chunkMsg));
    }
  }, [isMuted]);

  // Microphone audio capture setup
  const { start: startMic, stop: stopMic, isRecording, error: micError } = useMicrophone({
    onAudioChunk: handleMicrophoneChunk,
    onStart: () => {
      addLog("system", "microphone_active", "Audio stream transmitting at 16kHz Mono PCM.");
    },
    onStop: () => {
      addLog("system", "microphone_inactive", "Microphone capture offline.");
    }
  });

  // Keep track of active recording status depending on CallState
  useEffect(() => {
    if (callState === "active") {
      startMic();
    } else {
      stopMic();
      stopPlayback();
    }
  }, [callState, startMic, stopMic, stopPlayback]);

  // Surface microphone failures loudly instead of silently swallowing them.
  // A call was previously able to show "connected" while zero audio was ever
  // captured (permission denied, no device, or blocked in an embedded iframe
  // preview context), with the failure only visible in the browser devtools
  // console and never in the app UI itself.
  useEffect(() => {
    if (micError) {
      addLog("system", "microphone_error", micError);
      if (callState === "active") {
        setCallState("ended");
        addLog("system", "call_ended_mic_failure", "Call ended: microphone was unavailable, so Gemini never received any audio.");
      }
    }
  }, [micError]);

  // Sync AI voice player state with our Pipeline status indicator
  useEffect(() => {
    if (isPlaying) {
      setPipelineState("speaking");
    } else {
      setPipelineState((prev) => (prev === "speaking" ? "idle" : prev));
    }
  }, [isPlaying]);

  // Commit text speech logs to dialog history when AI finishes speaking
  useEffect(() => {
    if (!isPlaying && currentAiText) {
      setChatHistory((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "assistant",
          text: currentAiText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
      setCurrentAiText("");
    }
  }, [isPlaying, currentAiText]);

  // Stop current active call session
  const hangUpCall = useCallback(async () => {
    setCallState("idle");
    setIsSwappingVoice(false);
    
    if (activeCallSessionId && authToken) {
      const durationSeconds = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      try {
        await fetch(`/api/calls/${activeCallSessionId}/end`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify({ durationSeconds })
        });
        fetchCalls();
      } catch (err) {
        console.error("Failed to end call session on server:", err);
      }
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopPlayback();
    setActiveCallSessionId(null);
    addLog("system", "call_hung_up", "The active voice conversation was ended.");
  }, [stopPlayback, addLog, activeCallSessionId, authToken, fetchCalls]);

  // Dynamic voice hot swapping callback during a call
  const changeVoiceMidCall = useCallback((voiceId: string) => {
    setSelectedVoice(voiceId);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      addLog("out", "update_config", { voiceId, systemPrompt });
      wsRef.current.send(JSON.stringify({
        type: "update_config",
        data: {
          voiceId,
          systemPrompt
        }
      }));
    }
  }, [systemPrompt, addLog]);

  // Dynamic persona hot swapping callback during a call
  const changePersonaMidCall = useCallback((personaId: string) => {
    const found = AI_PERSONAS.find(p => p.id === personaId);
    if (!found) return;
    const prompt = found.prompt;
    setSystemPrompt(prompt);
    activePromptRef.current = prompt;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      addLog("out", "update_config", { voiceId: selectedVoice, systemPrompt: prompt });
      wsRef.current.send(JSON.stringify({
        type: "update_config",
        data: {
          voiceId: selectedVoice,
          systemPrompt: prompt
        }
      }));
    }
  }, [selectedVoice, addLog]);

  // Pushes the Call Topic text straight into the live Gemini session as an
  // out-of-band operator directive (not audio, doesn't wait for the mic) --
  // this is what actually makes typing something mid-call affect what the AI
  // says next, unlike the old "AI Command Panel" which only logged to the DB.
  const sendLiveDirective = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      addLog("out", "live_directive", { text });
      wsRef.current.send(JSON.stringify({
        type: "live_directive",
        data: { text }
      }));
    }
  }, [addLog]);

  // Handle connection trigger
  const handlePlaceCall = (overrideContactId?: string | null) => {
    activePromptRef.current = systemPrompt;
    activeTopicRef.current = callTopic;
    callStartTimeRef.current = Date.now();
    const targetContactId = overrideContactId !== undefined ? overrideContactId : selectedContactId;
    startCallSession(targetContactId);
  };

  // Preset prompts to help user bootstrap
  const PRESET_DIRECTIONS = [
    {
      title: "Friendly Chat Partner",
      prompt: "You are an engaging phone partner. Keep your replies friendly, conversational, and concise. Ask questions to keep the flow alive!"
    },
    {
      title: "Job Interviewer",
      prompt: "You are a professional, slightly tough technical interviewer conducting a phone screen. Give concise, sharp questions and realistic feedback."
    },
    {
      title: "Spanish Tutor",
      prompt: "You are a helpful and supportive Spanish conversation teacher. Speak in a mix of slow Spanish and English. Correct my mistakes kindly."
    },
    {
      title: "Zen Breath Coach",
      prompt: "You are a peaceful, calm meditation guide. Walk me through rhythmic breathing exercises and offer short, soothing reflections."
    }
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-xs text-slate-500 font-mono">Syncing secure credentials with Node...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative">
        {currentRoute === "admin" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
            <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-xl backdrop-blur-md">
              <Lock className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                <strong>Admin Portal:</strong> Please sign in with an authorized Administrator account to continue.
              </span>
            </div>
          </div>
        )}
        <AuthScreen 
          onSuccess={(token, loggedUser) => {
            setAuthToken(token);
            setUser(loggedUser);
          }} 
        />
      </div>
    );
  }

  // Secure Admin Access Check: Access Denied Page
  if (currentRoute === "admin" && userRole !== "admin") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative font-sans text-slate-100">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-red-600/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-red-500/20 rounded-3xl p-8 shadow-2xl relative text-center"
        >
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mb-2">Access Denied</h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Your account <span className="text-slate-200 font-mono font-bold">{user?.email}</span> does not have Administrator privileges. Please sign in with an authorized administrator account or return to the main dashboard.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigateTo("home")}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-bold py-3 px-6 rounded-xl text-xs hover:from-indigo-500 hover:to-violet-400 transition-all cursor-pointer shadow-lg shadow-indigo-500/10"
            >
              Go to Home Screen
            </button>
            <button
              onClick={async () => {
                await getSupabase().auth.signOut();
              }}
              className="w-full bg-white/5 border border-white/10 text-slate-400 hover:text-white font-bold py-3 px-6 rounded-xl text-xs hover:bg-white/10 transition-all cursor-pointer"
            >
              Sign Out & Switch Account
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Secure Admin Access Check: Full-screen Admin Console for Authorized Admins
  if (currentRoute === "admin" && userRole === "admin") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col font-sans p-4 sm:p-6 md:p-8 relative">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col z-10">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => navigateTo("home")}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300 font-bold hover:bg-white/10 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              ← Back to Main App
            </button>
            <div className="text-xs text-slate-500 font-mono">
              Signed in as admin: <span className="text-indigo-400">{user?.email}</span>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <AdminConsole
              authToken={authToken}
              onClose={() => navigateTo("home")}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200 relative overflow-x-hidden">
      
      {/* Immersive visual dynamic lighting spheres */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* User Profile Modal Overlay */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg"
            >
              <UserProfileModal
                user={user}
                userRole={userRole}
                userStatus={userStatus}
                onClose={() => setShowProfileModal(false)}
                onLogout={async () => {
                  setShowProfileModal(false);
                  await getSupabase().auth.signOut();
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Dashboard Overlay */}
      <AnimatePresence>
        {showAdminConsole && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-5xl h-[85vh]"
            >
              <AdminConsole
                authToken={authToken}
                onClose={() => setShowAdminConsole(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Voice Selection Modal Overlay */}
      <AnimatePresence>
        {showVoiceModal && (
          <VoiceSelectionModal
            currentVoiceId={selectedVoice}
            voices={VOICES}
            onSave={handleSaveVoicePreference}
            onClose={() => setShowVoiceModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Main RESPONSIVE AI Header */}
      <header className="border-b border-white/5 bg-slate-950/60 backdrop-blur-md relative z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Phone className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <span className="font-semibold text-white tracking-tight block text-sm sm:text-base">RESPONSIVE AI</span>
              <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-widest block -mt-1">Duplex Voice Node</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Profile trigger */}
            <button
              onClick={() => setShowProfileModal(true)}
              className="p-2 rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
              title="Manage Account Profile"
            >
              <User className="w-4 h-4" />
              <span className="hidden md:inline">{user?.displayName || "My Profile"}</span>
            </button>

            {/* Discreet Aesthetic Hidden Entry Symbol */}
            <button
              onClick={() => navigateTo("admin")}
              className="w-1.5 h-1.5 rounded-full bg-slate-700/30 hover:bg-slate-500/40 active:scale-90 transition-all cursor-pointer self-center ml-1"
              aria-label="System Accent"
            />

          </div>
        </div>
      </header>

      {/* Core Interface Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 relative z-10 flex flex-col justify-center">
        
        <AnimatePresence mode="wait">
          
          {/* STAGE 1: Minimalist Apple-Style Pre-Call Dialer Stage */}
          {callState === "idle" && (
            <motion.div
              key="minimal-dialer"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex flex-col items-center justify-center py-8 space-y-8 max-w-md mx-auto w-full"
            >
              {/* Contact Stage Card */}
              <div className="text-center space-y-4 w-full">
                {/* Large Apple-style Avatar bubble */}
                <div className="relative mx-auto w-28 h-28">
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
                  <div className="relative w-28 h-28 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center shadow-2xl">
                    {selectedContactId ? (
                      <span className="text-3xl font-black text-indigo-300 select-none">
                        {contacts.find(c => c.id === selectedContactId)?.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                      </span>
                    ) : (
                      <User className="w-12 h-12 text-slate-500" />
                    )}
                  </div>
                </div>

                {/* Contact Name & Company details */}
                <div className="space-y-1">
                  <h1 className="text-2xl font-black tracking-tight text-white">
                    {selectedContactId 
                      ? contacts.find(c => c.id === selectedContactId)?.name 
                      : "No Contact Selected"
                    }
                  </h1>
                  <p className="text-xs text-slate-400 font-mono uppercase tracking-wider">
                    {selectedContactId 
                      ? (contacts.find(c => c.id === selectedContactId)?.company || "Independent client") 
                      : "Choose a contact profile to initiate call"
                    }
                  </p>
                </div>

                {/* Active settings indicators pill */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-bold text-indigo-300 font-mono uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {AI_PERSONAS.find(p => p.id === selectedPersona)?.name || "Friendly Persona"}
                  </span>
                  <span className="text-indigo-600/60">•</span>
                  <span>
                    Voice: {VOICES.find(v => v.id === selectedVoice)?.name || selectedVoice}
                  </span>
                </div>
              </div>

              {/* Action controller deck */}
              <div className="grid grid-cols-3 gap-3.5 w-full bg-slate-900/40 border border-white/5 rounded-3xl p-4.5 backdrop-blur-md shadow-xl">
                {/* Voice Modal button */}
                <button
                  onClick={() => setShowVoiceModal(true)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-black/25 hover:bg-black/40 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer group"
                  title="Choose active voice actor"
                >
                  <Volume2 className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-all" />
                  <span className="text-[10px] font-black uppercase tracking-wider font-mono">Voice</span>
                </button>

                {/* Control Center button */}
                <button
                  onClick={() => setShowThreeDotMenuModal(true)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-black/25 hover:bg-black/40 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer group"
                  title="Open Control Center"
                >
                  <Settings className="w-5 h-5 text-indigo-400 group-hover:rotate-45 transition-transform duration-300" />
                  <span className="text-[10px] font-black uppercase tracking-wider font-mono">Menu</span>
                </button>

                {/* Change Contact button */}
                <button
                  onClick={() => setShowCallContactSelectorModal(true)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-black/25 hover:bg-black/40 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer group"
                  title="Select Contact Directory"
                >
                  <User className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-all" />
                  <span className="text-[10px] font-black uppercase tracking-wider font-mono">Contact</span>
                </button>
              </div>

              {/* Glowing Green Phone Dial Button */}
              <div className="pt-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (selectedContactId) {
                      handlePlaceCall();
                    } else {
                      setShowCallContactSelectorModal(true);
                    }
                  }}
                  className="w-20 h-20 bg-gradient-to-tr from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/35 transition-all cursor-pointer border border-emerald-400/20 relative group"
                  title="Place Call Session"
                >
                  <div className="absolute inset-0 rounded-full bg-emerald-500/25 animate-ping group-hover:opacity-75 pointer-events-none" />
                  <Phone className="w-9 h-9 fill-current" />
                </motion.button>
                <span className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest text-center mt-3.5">
                  Start call session
                </span>
              </div>
            </motion.div>
          )}

          {/* STAGE 2: Immersive Call Cockpit with integrated side panels */}
          {callState !== "idle" && (
            <motion.div
              key="active-call-cockpit"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="space-y-6 w-full"
            >
              {/* Main caller grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* Left Side: Call Screen Stage & controls */}
                <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-md flex flex-col items-center justify-center space-y-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-pink-500 to-rose-400 opacity-60" />

                  {/* Caller Details Info */}
                  <div className="text-center space-y-2">
                    {/* Pulsing Avatar Stage */}
                    <div className="relative mx-auto w-24 h-24">
                      {/* Speaks animation waves */}
                      <AnimatePresence>
                        {pipelineState === "speaking" && (
                          <>
                            <motion.div 
                              initial={{ scale: 0.95, opacity: 0 }}
                              animate={{ scale: [1, 1.4, 1], opacity: [0.1, 0.3, 0.1] }}
                              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                              className="absolute inset-0 rounded-full bg-indigo-500/20 blur-md"
                            />
                            <motion.div 
                              initial={{ scale: 0.95, opacity: 0 }}
                              animate={{ scale: [1, 1.8, 1], opacity: [0.05, 0.15, 0.05] }}
                              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                              className="absolute inset-0 rounded-full bg-indigo-500/10 blur-lg"
                            />
                          </>
                        )}
                        {pipelineState === "listening" && (
                          <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: [1, 1.25, 1], opacity: [0.1, 0.25, 0.1] }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                            className="absolute inset-0 rounded-full bg-emerald-500/20 blur-md"
                          />
                        )}
                      </AnimatePresence>

                      <div className={`relative w-24 h-24 rounded-full bg-slate-950 border flex items-center justify-center shadow-inner transition-all duration-500 ${
                        pipelineState === "speaking" ? "border-indigo-500/40 shadow-lg shadow-indigo-500/10" :
                        pipelineState === "listening" ? "border-emerald-500/40 shadow-lg shadow-emerald-500/10" : "border-white/5"
                      }`}>
                        {selectedContactId ? (
                          <span className="text-2xl font-black text-indigo-300 select-none">
                            {contacts.find(c => c.id === selectedContactId)?.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                          </span>
                        ) : (
                          <User className="w-10 h-10 text-slate-400" />
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-mono font-bold text-slate-500 tracking-widest block uppercase">
                        {pipelineState === "speaking" ? "AI Speaking" :
                         pipelineState === "listening" ? (isMuted ? "Muted" : "Listening...") :
                         pipelineState === "thinking" ? "Thinking..." : "Secure Connection"
                        }
                      </span>
                      <h2 className="text-xl font-extrabold text-white">
                        {selectedContactId 
                          ? contacts.find(c => c.id === selectedContactId)?.name 
                          : "Anonymous Caller"
                        }
                      </h2>
                      
                      {/* Call Timer Display */}
                      <span className="font-mono text-sm font-bold text-slate-300 block">
                        {callState === "active" ? formatLiveDuration(liveDurationSeconds) : "Connecting..."}
                      </span>
                    </div>
                  </div>

                  {/* Pulsing Visual Waveform Bars */}
                  <div className="h-10 flex items-center justify-center gap-1 bg-black/25 border border-white/5 px-6 py-2.5 rounded-2xl w-full">
                    {pipelineState === "speaking" || pipelineState === "listening" ? (
                      [...Array(11)].map((_, i) => (
                        <motion.div 
                          key={i}
                          animate={{ height: [4, i % 2 === 0 ? 28 : 16, 4] }}
                          transition={{ repeat: Infinity, duration: 0.3 + i * 0.05, ease: "easeInOut" }}
                          className={`w-1 rounded-full ${pipelineState === "listening" ? "bg-emerald-400" : "bg-indigo-400"}`}
                        />
                      ))
                    ) : (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">
                        <Activity className="w-4.5 h-4.5 text-slate-600 animate-pulse" />
                        <span>Awaiting duplex speech...</span>
                      </div>
                    )}
                  </div>

                  {/* Primary Tool Controllers */}
                  <div className="flex items-center justify-center gap-3.5 w-full">
                    {/* Mute Button */}
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isMuted 
                          ? "bg-rose-500/15 border-rose-500/30 text-rose-400" 
                          : "bg-slate-950 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-900"
                      }`}
                      title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                    >
                      {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    {/* End Call Button */}
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={hangUpCall}
                      className="px-6 py-3.5 bg-gradient-to-tr from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-extrabold rounded-2xl flex items-center gap-2 text-xs shadow-lg shadow-red-500/25 cursor-pointer border border-red-500/20"
                      title="Hang up Call"
                    >
                      <PhoneOff className="w-4 h-4" />
                      <span>End Conversation</span>
                    </motion.button>

                    {/* Interruption Button */}
                    <button
                      disabled={!isPlaying}
                      onClick={stopPlayback}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isPlaying 
                          ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/25" 
                          : "bg-slate-950 border border-white/5 text-slate-600 cursor-not-allowed"
                      }`}
                      title="Stop Speech (Interrupt)"
                    >
                      <VolumeX className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Mid-Call Persona & Voice Hot-Swapping Panel */}
                  <div className="w-full border-t border-white/5 pt-4.5 space-y-4">
                    {/* Voice hot swapper */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-mono font-bold text-slate-500 block uppercase tracking-widest">
                        Hot-Swap Voice Actor
                      </span>
                      <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-thin">
                        {VOICES.map((voice) => {
                          const isCurrent = selectedVoice === voice.id;
                          return (
                            <button
                              key={voice.id}
                              disabled={isSwappingVoice}
                              onClick={() => {
                                if (!isCurrent) {
                                  setIsSwappingVoice(true);
                                  changeVoiceMidCall(voice.id);
                                }
                              }}
                              className={`flex-shrink-0 px-3 py-2 rounded-xl border text-left transition-all text-[11px] font-bold flex items-center gap-2 cursor-pointer ${
                                isCurrent
                                  ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-200"
                                  : "bg-black/20 border-white/5 text-slate-400 hover:border-white/10"
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-sm bg-gradient-to-tr ${voice.avatarBg} flex items-center justify-center text-[8px] font-black text-white shrink-0`}>
                                {voice.name[0]}
                              </div>
                              <span>{voice.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Persona hot swapper */}
                    <div className="space-y-2 border-t border-white/[0.03] pt-3.5">
                      <span className="text-[9px] font-mono font-bold text-slate-500 block uppercase tracking-widest">
                        Hot-Swap AI Persona Context
                      </span>
                      <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-thin">
                        {AI_PERSONAS.map((p) => {
                          const isCurrent = selectedPersona === p.id;
                          return (
                            <button
                              key={p.id}
                              onClick={() => {
                                if (!isCurrent) {
                                  setSelectedPersona(p.id);
                                  changePersonaMidCall(p.id);
                                }
                              }}
                              className={`flex-shrink-0 px-3 py-2 rounded-xl border text-left transition-all text-[11px] font-bold flex items-center gap-2 cursor-pointer ${
                                isCurrent
                                  ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-200"
                                  : "bg-black/20 border-white/5 text-slate-400 hover:border-white/10"
                              }`}
                            >
                              <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-tr ${p.color} shrink-0`} />
                              <span>{p.name.split(" ").pop()}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Right Side: Intelligent Co-Pilot commands (live transcript view removed --
                    conversation is still recorded and saved silently in the background) */}
                <div className="grid grid-cols-1 gap-6">
                  <CallTopicPanel
                    value={callTopic}
                    onChange={setCallTopic}
                    isLive={true}
                    onSendLive={sendLiveDirective}
                  />
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {/* TELEMETRY PACKET CONSOLE */}
        <AnimatePresence>
          {showDevConsole && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 border border-white/10 rounded-3xl bg-slate-950 overflow-hidden flex flex-col max-h-[250px]"
            >
              {/* Header console */}
              <div className="bg-white/[0.02] border-b border-white/10 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <span className="text-xs font-bold text-white">Full-Duplex Packet Telemetry</span>
                </div>
                <button 
                  onClick={() => setLogs([])}
                  className="text-[10px] font-mono text-slate-400 hover:text-white transition-all bg-white/5 border border-white/15 px-2 py-0.5 rounded cursor-pointer"
                >
                  Clear Logs
                </button>
              </div>

              {/* Filters panel */}
              <div className="bg-slate-900/30 border-b border-white/5 px-4 py-1.5 flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 font-mono">FILTER:</span>
                {(["all", "in", "out", "system"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize transition-all cursor-pointer ${
                      filterType === type 
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold" 
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Scrollable logs list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs scrollbar-thin">
                {logs.filter(log => filterType === "all" || log.type === filterType).length === 0 ? (
                  <div className="text-slate-600 text-[11px] italic py-8 text-center">
                    No active telemetry log entries.
                  </div>
                ) : (
                  logs.filter(log => filterType === "all" || log.type === filterType).map((log) => (
                    <div key={log.id} className="border-b border-white/[0.03] pb-2 last:border-b-0">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1 rounded uppercase tracking-tight text-[8px] font-bold ${
                            log.type === "in" 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                              : log.type === "out" 
                              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" 
                              : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                          }`}>
                            {log.type === "in" ? "← Rx" : log.type === "out" ? "→ Tx" : "Sys"}
                          </span>
                          <span className="font-semibold text-slate-300">{log.event}</span>
                        </div>
                        <span>{log.timestamp}</span>
                      </div>

                      <pre className="text-[10px] text-slate-400 bg-black/40 p-2 rounded border border-white/5 overflow-x-auto whitespace-pre-wrap max-h-24 scrollbar-thin">
                        {typeof log.payload === "object" 
                          ? JSON.stringify(log.payload, null, 2) 
                          : String(log.payload)
                        }
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Modern overlays */}
      <AnimatePresence>
        {showThreeDotMenuModal && (
          <ThreeDotMenuModal
            isOpen={showThreeDotMenuModal}
            onClose={() => setShowThreeDotMenuModal(false)}
            contacts={contacts}
            selectedContactId={selectedContactId}
            onSelectContact={setSelectedContactId}
            onCreateContact={handleCreateContact}
            onDeleteContact={handleDeleteContact}
            calls={calls}
            authToken={authToken}
            user={user}
            userRole={userRole}
            selectedVoice={selectedVoice}
            onSelectVoice={(voiceId) => {
              handleSaveVoicePreference(voiceId);
            }}
            selectedPersona={selectedPersona}
            onSelectPersona={(personaId) => {
              handleSavePersonaPreference(personaId);
            }}
            onOpenAdmin={() => {
              navigateTo("admin");
            }}
            showDevConsole={showDevConsole}
            onToggleDevConsole={() => setShowDevConsole(!showDevConsole)}
            callTopic={callTopic}
            onChangeCallTopic={setCallTopic}
          />
        )}

        {showCallContactSelectorModal && (
          <CallContactSelectorModal
            isOpen={showCallContactSelectorModal}
            onClose={() => setShowCallContactSelectorModal(false)}
            contacts={contacts}
            onSelectAndStartCall={(contactId) => {
              setSelectedContactId(contactId);
              setShowCallContactSelectorModal(false);
              handlePlaceCall(contactId);
            }}
            onCreateContact={handleCreateContact}
          />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-6 border-t border-white/5 text-center text-[11px] text-slate-500 relative z-10 flex flex-col items-center justify-center gap-1.5 bg-slate-950">
        <p>RESPONSIVE AI</p>
        <div className="flex items-center gap-2 text-slate-600/80">
          <span>v1.3.0</span>
          <span className="text-slate-800 select-none">•</span>
          <span>Secure Connection Active</span>
          <button
            onClick={() => navigateTo("admin")}
            className="text-slate-800/40 hover:text-slate-500/60 active:scale-90 transition-all cursor-pointer select-none ml-0.5 p-1 rounded"
            aria-label="System Accent"
          >
            ✦
          </button>
        </div>
      </footer>

    </div>
  );
}
