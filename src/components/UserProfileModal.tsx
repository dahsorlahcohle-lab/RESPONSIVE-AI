import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  User, 
  Settings, 
  History, 
  Clock, 
  LogOut, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  X,
  Shield,
  Activity,
  Calendar,
  Lock
} from "lucide-react";

interface UserProfileModalProps {
  user: any;
  userRole: string;
  userStatus: string;
  onClose: () => void;
  authToken: string;
  calls: any[];
}

export default function UserProfileModal({ user, userRole, userStatus, onClose, authToken, calls }: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "history">("profile");
  
  // Profile settings state
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [newPassword, setNewPassword] = useState("");
  
  // Call history state
  const [personalCalls, setPersonalCalls] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Status message states
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Fetch personal call history from the app API (owner account)
  const fetchPersonalHistory = async () => {
    if (!authToken) return;
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/calls", {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (data.success) {
        const list = (data.calls || []).map((row: any) => ({
          id: row.id,
          voiceId: row.personality_name || row.selected_voice || "AI",
          status: row.status,
          durationSeconds: row.duration_seconds,
          createdAt: row.created_at,
          endedAt: row.ended_at
        }));
        setPersonalCalls(list);
      }
    } catch (err) {
      console.error("Failed to fetch personal call history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      fetchPersonalHistory();
    }
  }, [activeTab]);

  // Single-owner mode: profile is read-only (no auth system to update)
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ text: "Account details are fixed in single-owner mode.", type: "error" });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full font-sans max-w-lg w-full">
      
      {/* Header */}
      <div className="p-6 border-b border-white/10 bg-black/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white tracking-tight">
              My User Account
            </h3>
            <p className="text-xs text-slate-400">
              Personal credentials, preferences, and session logs
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Profile summary banner */}
      <div className="p-6 bg-indigo-950/20 border-b border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-lg font-black text-white shadow">
            {displayName?.[0] || user?.email?.[0] || "?"}
          </div>
          <div>
            <h4 className="font-bold text-white text-sm tracking-tight">{displayName || "Anonymous User"}</h4>
            <span className="block text-[10px] text-slate-500 font-mono mt-0.5">{user?.email}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border ${
            userRole === "admin" 
              ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" 
              : "bg-white/5 text-slate-400 border-white/5"
          }`}>
            Role: {userRole}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Status: {userStatus}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 bg-black/10 px-6 gap-6 text-xs font-mono">
        <button
          onClick={() => setActiveTab("profile")}
          className={`py-3 font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "profile" ? "text-indigo-400 border-indigo-400" : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Profile Settings
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`py-3 font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "history" ? "text-indigo-400 border-indigo-400" : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          My Call History
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
        
        {msg && (
          <div className={`mb-5 p-3.5 border rounded-2xl flex items-start gap-2.5 text-xs ${
            msg.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" 
              : "bg-rose-500/10 border-rose-500/20 text-rose-300"
          }`}>
            {msg.type === "success" ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <Shield className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          
          {/* Tab 1: Account Info (read-only in single-owner mode) */}
          {activeTab === "profile" && (
            <motion.div
              key="profile-info"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {msg && (
                <div className={`mb-5 p-3.5 border rounded-2xl flex items-start gap-2.5 text-xs ${
                  msg.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                }`}>
                  {msg.type === "success" ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <Shield className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{msg.text}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block ml-1">
                  Full Display Name
                </label>
                <div className="w-full bg-black/40 border border-white/5 rounded-xl py-3 px-4 text-xs text-slate-200">
                  {user?.displayName || "Dahsorlah"}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block ml-1">
                  Email
                </label>
                <div className="w-full bg-black/40 border border-white/5 rounded-xl py-3 px-4 text-xs text-slate-400 font-mono">
                  {user?.email}
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                This app runs in single-owner mode — account details are fixed and no login is required.
              </p>
            </motion.div>
          )}

          {/* Tab 2: Personal Call History */}
          {activeTab === "history" && (
            <motion.div
              key="history-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 font-mono">
                  All personal calls logged in Supabase
                </span>
                <button
                  onClick={fetchPersonalHistory}
                  className="text-[10px] text-indigo-400 flex items-center gap-1 hover:underline"
                >
                  <RefreshCw className={`w-3 h-3 ${historyLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              {historyLoading ? (
                <div className="py-8 flex items-center justify-center text-slate-500 text-xs gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading session data...
                </div>
              ) : personalCalls.length === 0 ? (
                <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center text-slate-500 italic text-xs">
                  No personal vocal sessions logged yet. Place a call!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {personalCalls.map((call) => {
                    const isActive = call.status === "active";
                    return (
                      <div
                        key={call.id}
                        className="p-3.5 bg-black/30 border border-white/5 rounded-2xl flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              Voice: {call.voiceId}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              isActive 
                                ? "bg-amber-400/10 text-amber-400 border border-amber-400/20" 
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"
                            }`}>
                              {call.status}
                            </span>
                          </div>
                          <span className="block text-[9px] text-slate-500 font-mono">
                            {call.createdAt ? new Date(call.createdAt).toLocaleString() : ""}
                          </span>
                        </div>

                        <div className="text-right font-mono text-[11px] text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {isActive ? (
                            <span className="text-amber-400 font-bold animate-pulse">Live</span>
                          ) : (
                            formatDuration(call.durationSeconds)
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
