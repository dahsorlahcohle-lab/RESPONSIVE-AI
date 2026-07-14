import React from "react";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Volume2,
  UserCircle2,
  Phone,
  Clock,
  Settings,
  ChevronRight,
  Plus,
  Trash2,
  Edit3,
  Check,
  PhoneCall,
  User
} from "lucide-react";
import type { VoiceOption } from "../App";

export interface Personality {
  id: string;
  name: string;
  role: string;
  communication_style: string;
  knowledge_area: string;
  behavior_pattern: string;
  created_at: string;
}

interface RecentCall {
  id: string;
  personality_name: string;
  created_at: string;
  duration_seconds: number;
}

interface SidebarPanelProps {
  isOpen: boolean;
  onClose: () => void;
  voices: VoiceOption[];
  selectedVoice: string;
  onVoiceSelect: (voiceId: string) => void;
  personalities: Personality[];
  recentCalls: RecentCall[];
  authToken: string;
  onPersonalitiesChange: (list: Personality[]) => void;
  onStartCall: (personality: Personality) => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
}

type Tab = "voice" | "personality" | "recent";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Create / Edit Personality Form ──────────────────────────────────────────
interface PersonalityFormProps {
  initial?: Partial<Personality>;
  onSave: (data: Omit<Personality, "id" | "created_at">) => void;
  onCancel: () => void;
  isSaving: boolean;
}
function PersonalityForm({ initial, onSave, onCancel, isSaving }: PersonalityFormProps) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    role: initial?.role || "",
    communication_style: initial?.communication_style || "",
    knowledge_area: initial?.knowledge_area || "",
    behavior_pattern: initial?.behavior_pattern || ""
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="flex flex-col gap-3 p-3 bg-black/20 rounded-2xl border border-white/5">
      <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">
        {initial?.id ? "Edit Personality" : "New Personality"}
      </p>
      {[
        { key: "name", label: "Name", placeholder: "e.g. Business Advisor" },
        { key: "role", label: "Role / Title", placeholder: "e.g. Investment Consultant" },
        { key: "communication_style", label: "Communication Style", placeholder: "e.g. Professional and concise" },
        { key: "knowledge_area", label: "Knowledge Area", placeholder: "e.g. Finance, markets, investing" },
        { key: "behavior_pattern", label: "Behavior Pattern", placeholder: "e.g. Data-driven, gives clear advice" }
      ].map(({ key, label, placeholder }) => (
        <div key={key} className="flex flex-col gap-1">
          <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">{label}</label>
          <input
            value={(form as any)[key]}
            onChange={set(key as any)}
            placeholder={placeholder}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 w-full"
          />
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={!form.name || !form.role || isSaving}
          className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Sidebar Panel ───────────────────────────────────────────────────────
export default function SidebarPanel({
  isOpen,
  onClose,
  voices,
  selectedVoice,
  onVoiceSelect,
  personalities,
  recentCalls,
  authToken,
  onPersonalitiesChange,
  onStartCall,
  onOpenSettings,
  onOpenProfile,
}: SidebarPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("personality");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSave = useCallback(async (data: Omit<Personality, "id" | "created_at">) => {
    setIsSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/personalities/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify(data)
        });
        const j = await res.json();
        if (j.success) {
          onPersonalitiesChange(personalities.map(p => p.id === editingId ? j.personality : p));
          setEditingId(null);
        }
      } else {
        const res = await fetch("/api/personalities", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify(data)
        });
        const j = await res.json();
        if (j.success) {
          onPersonalitiesChange([j.personality, ...personalities]);
          setShowForm(false);
        }
      }
    } finally {
      setIsSaving(false);
    }
  }, [editingId, personalities, authToken, onPersonalitiesChange]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/personalities/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` }
      });
      onPersonalitiesChange(personalities.filter(p => p.id !== id));
    } finally {
      setDeletingId(null);
    }
  }, [personalities, authToken, onPersonalitiesChange]);

  const navItems: { id: Tab; label: string; icon: any }[] = [
    { id: "voice", label: "Voice", icon: Volume2 },
    { id: "personality", label: "Personality", icon: UserCircle2 },
    { id: "recent", label: "Recent", icon: Clock }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel slides in from right */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-80 max-w-[90vw] bg-slate-950/98 border-l border-white/8 z-[90] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 shrink-0">
              <span className="text-sm font-bold text-white tracking-tight">Control Panel</span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1 px-3 py-2.5 border-b border-white/5 shrink-0">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                    activeTab === id
                      ? "bg-indigo-600/20 border border-indigo-500/30 text-indigo-300"
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">

              {/* ── VOICE TAB ── */}
              {activeTab === "voice" && (
                <div className="flex flex-col gap-2">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold px-1">Select AI Voice</p>
                  {voices.map(v => (
                    <button
                      key={v.id}
                      onClick={() => onVoiceSelect(v.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left w-full ${
                        selectedVoice === v.id
                          ? "bg-indigo-600/15 border-indigo-500/40 text-white"
                          : "bg-white/3 border-white/5 text-slate-300 hover:bg-white/5 hover:border-white/10"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${v.avatarBg} shrink-0 flex items-center justify-center text-[10px] font-black text-white`}>
                        {v.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{v.name}</p>
                        <p className="text-[9px] text-slate-500 truncate">{v.style}</p>
                      </div>
                      {selectedVoice === v.id && (
                        <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* ── PERSONALITY TAB ── */}
              {activeTab === "personality" && (
                <div className="flex flex-col gap-3">
                  {/* New personality button */}
                  {!showForm && !editingId && (
                    <button
                      onClick={() => setShowForm(true)}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/10 text-xs font-bold transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create New Personality
                    </button>
                  )}

                  {/* Create form */}
                  {showForm && !editingId && (
                    <PersonalityForm
                      onSave={handleSave}
                      onCancel={() => setShowForm(false)}
                      isSaving={isSaving}
                    />
                  )}

                  {/* List */}
                  {personalities.length === 0 && !showForm && (
                    <div className="text-center py-8 text-slate-600 text-xs">
                      No personalities yet.<br />Create one to get started.
                    </div>
                  )}

                  {personalities.map(p => (
                    <div key={p.id}>
                      {editingId === p.id ? (
                        <PersonalityForm
                          initial={p}
                          onSave={handleSave}
                          onCancel={() => setEditingId(null)}
                          isSaving={isSaving}
                        />
                      ) : (
                        <div className="bg-white/3 border border-white/5 rounded-2xl p-3 flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-white">{p.name}</p>
                              <p className="text-[9px] text-indigo-400 mt-0.5">{p.role}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => setEditingId(p.id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                                title="Edit"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                disabled={deletingId === p.id}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            {[
                              ["Style", p.communication_style],
                              ["Knowledge", p.knowledge_area],
                              ["Behavior", p.behavior_pattern]
                            ].map(([label, val]) => val ? (
                              <div key={label} className="flex gap-1.5 text-[9px]">
                                <span className="text-slate-600 uppercase tracking-wider font-semibold shrink-0 w-14">{label}</span>
                                <span className="text-slate-400 truncate">{val}</span>
                              </div>
                            ) : null)}
                          </div>
                          <button
                            onClick={() => { onStartCall(p); onClose(); }}
                            className="flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all mt-1"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            Call {p.name}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── RECENT TAB ── */}
              {activeTab === "recent" && (
                <div className="flex flex-col gap-2">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold px-1">Recent Calls</p>
                  {recentCalls.length === 0 && (
                    <div className="text-center py-8 text-slate-600 text-xs">No calls yet.</div>
                  )}
                  {recentCalls.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-3 bg-white/3 border border-white/5 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        <Phone className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{c.personality_name || "AI Assistant"}</p>
                        <p className="text-[9px] text-slate-500">{timeAgo(c.created_at)} · {fmtDuration(c.duration_seconds || 0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer – Profile + Settings */}
            <div className="shrink-0 px-3 py-3 border-t border-white/5 flex flex-col gap-1">
              <button
                onClick={onOpenProfile}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-xs font-bold transition-all"
              >
                <User className="w-4 h-4" />
                My Profile
                <ChevronRight className="w-3.5 h-3.5 ml-auto" />
              </button>
              <button
                onClick={() => { onOpenSettings(); onClose(); }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-xs font-bold transition-all"
              >
                <Settings className="w-4 h-4" />
                System Settings
                <ChevronRight className="w-3.5 h-3.5 ml-auto" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
