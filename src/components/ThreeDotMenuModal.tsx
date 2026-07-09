import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, User, History, Cpu, Settings, Search, Plus, Trash2, Phone, 
  Building, Sparkles, MessageSquare, Download, Check, Volume2, 
  Sliders, Shield, Bell, Eye, EyeOff, Terminal, Activity, HelpCircle
} from "lucide-react";
import { VoiceOption, VOICES } from "../App";

interface Contact {
  id: string;
  name: string;
  company: string;
  phone: string;
  notes: string;
  created_at?: string;
}

interface CallSession {
  id: string;
  contact_id?: string;
  contact_name?: string;
  contact_company?: string;
  selected_voice: string;
  duration_seconds: number;
  created_at: string;
  status: string;
  ai_notes?: string;
  ai_personality?: string;
}

interface TranscriptMessage {
  speaker: "User" | "AI";
  message: string;
  timestamp: string;
}

export interface AIPersona {
  id: string;
  name: string;
  description: string;
  prompt: string;
  style: string;
  color: string;
}

export const AI_PERSONAS: AIPersona[] = [
  {
    id: "friendly",
    name: "Friendly Companion",
    description: "Engaging companion, warm, concise, conversational.",
    prompt: "You are an engaging phone partner. Keep your replies friendly, conversational, and concise. Ask questions to keep the flow alive!",
    style: "Warm & Empathetic",
    color: "from-pink-500 to-rose-400"
  },
  {
    id: "interviewer",
    name: "Job Interviewer",
    description: "Professional, sharp questions, realistic tech interviewer.",
    prompt: "You are a professional, slightly tough technical interviewer conducting a phone screen. Give concise, sharp questions and realistic feedback.",
    style: "Professional Interviewer",
    color: "from-blue-600 to-indigo-500"
  },
  {
    id: "tutor",
    name: "Spanish Tutor",
    description: "Slow Spanish + English, corrections.",
    prompt: "You are a helpful and supportive Spanish conversation teacher. Speak in a mix of slow Spanish and English. Correct my mistakes kindly.",
    style: "Educational & Patient",
    color: "from-teal-500 to-emerald-400"
  },
  {
    id: "coach",
    name: "Zen Breath Coach",
    description: "Peaceful, calm zen breath coach.",
    prompt: "You are a peaceful, calm meditation guide. Walk me through rhythmic breathing exercises and offer short, soothing reflections.",
    style: "Peaceful & Calming",
    color: "from-violet-500 to-fuchsia-400"
  }
];

interface ThreeDotMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  selectedContactId: string | null;
  onSelectContact: (id: string | null) => void;
  onCreateContact: (name: string, company: string, phone: string, notes: string) => Promise<void>;
  onDeleteContact: (id: string) => Promise<void>;
  calls: CallSession[];
  authToken: string;
  user: any;
  userRole: string;
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
  onOpenAdmin: () => void;
  showDevConsole: boolean;
  onToggleDevConsole: () => void;
}

export default function ThreeDotMenuModal({
  isOpen,
  onClose,
  contacts,
  selectedContactId,
  onSelectContact,
  onCreateContact,
  onDeleteContact,
  calls,
  authToken,
  user,
  userRole,
  selectedVoice,
  onSelectVoice,
  onOpenAdmin,
  showDevConsole,
  onToggleDevConsole,
}: ThreeDotMenuModalProps) {
  const [activeTab, setActiveTab] = useState<"contacts" | "voice" | "history" | "settings">("contacts");
  
  // Contacts Tab State
  const [contactSearch, setContactSearch] = useState("");
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [contactSaving, setContactSaving] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Call Logs Tab State
  const [historySearch, setHistorySearch] = useState("");
  const [voiceFilter, setVoiceFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "longest" | "shortest">("newest");
  const [selectedCall, setSelectedCall] = useState<CallSession | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  // Settings Tab Mock States
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [continuousListening, setContinuousListening] = useState(true);
  const [highPerformanceMode, setHighPerformanceMode] = useState(true);
  const [saveCallNotes, setSaveCallNotes] = useState(true);

  // AI speed mock state
  const [aiSpeed, setAiSpeed] = useState(1.0);

  // Cleanup synthesis when closing
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Fetch full transcript when a call log is selected
  useEffect(() => {
    if (!selectedCall) return;
    
    const fetchTranscript = async () => {
      setTranscriptLoading(true);
      try {
        const response = await fetch(`/api/calls/${selectedCall.id}/transcript`, {
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        });
        const data = await response.json();
        if (data.success) {
          setTranscript(data.messages || []);
        } else {
          setTranscript([]);
        }
      } catch (err) {
        console.error("Failed to fetch transcript:", err);
        setTranscript([]);
      } finally {
        setTranscriptLoading(false);
      }
    };

    fetchTranscript();
  }, [selectedCall, authToken]);

  // Every call this contact has ever had, newest first -- the full archive lives
  // right under them (the AI's actual memory recall on the next call is handled
  // separately, server-side, and keeps working unchanged).
  const contactConversationHistory = selectedContactId
    ? calls
        .filter((c) => c.contact_id === selectedContactId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  if (!isOpen) return null;

  // Filter contacts
  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.company.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.phone.includes(contactSearch)
  );

  // Filter and sort Call History
  const filteredCalls = calls
    .filter(c => {
      const query = historySearch.toLowerCase();
      const nameMatch = c.contact_name?.toLowerCase().includes(query) || false;
      const companyMatch = c.contact_company?.toLowerCase().includes(query) || false;
      const voiceMatch = c.selected_voice.toLowerCase().includes(query);
      const personaMatch = c.ai_personality?.toLowerCase().includes(query) || false;
      const searchOk = nameMatch || companyMatch || voiceMatch || personaMatch || query === "";

      const voiceOk = voiceFilter === "all" || c.selected_voice === voiceFilter;

      return searchOk && voiceOk;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "longest") {
        return b.duration_seconds - a.duration_seconds;
      }
      if (sortBy === "shortest") {
        return a.duration_seconds - b.duration_seconds;
      }
      return 0;
    });

  const formatDuration = (sec: number) => {
    if (!sec) return "0s";
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateString;
    }
  };

  // CSV Export
  const exportLogsToCSV = () => {
    const headers = ["Session ID", "Contact Name", "Company", "Voice Model", "Duration (Sec)", "Timestamp", "Status", "AI Notes"];
    const rows = filteredCalls.map(c => [
      c.id,
      c.contact_name || "Anonymous",
      c.contact_company || "",
      c.selected_voice,
      c.duration_seconds,
      c.created_at,
      c.status,
      `"${(c.ai_notes || "").replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "responsive_ai_call_logs.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // JSON Export
  const exportLogsToJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredCalls, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", "responsive_ai_call_logs.json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setContactSaving(true);
    try {
      await onCreateContact(newName, newCompany, newPhone, newNotes);
      setNewName("");
      setNewCompany("");
      setNewPhone("");
      setNewNotes("");
      setIsAddingContact(false);
    } catch (err) {
      console.error(err);
    } finally {
      setContactSaving(false);
    }
  };

  return (
    <div id="unified_settings_overlay" className="fixed inset-0 bg-black/85 backdrop-blur-md z-45 flex items-center justify-center p-4">
      <motion.div
        id="unified_settings_container"
        initial={{ scale: 0.96, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 15 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-4xl h-[85vh] bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
      >
        {/* Left sidebar navigation */}
        <div className="w-full md:w-56 bg-slate-950/70 border-b md:border-b-0 md:border-r border-white/5 p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 px-2 py-1">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/25">
                <Sliders className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <span className="font-bold text-xs text-white uppercase tracking-wider block">Station Hub</span>
                <span className="text-[9px] font-mono text-slate-500">CONTROL CENTER</span>
              </div>
            </div>

            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
              <button
                onClick={() => { setActiveTab("contacts"); setSelectedCall(null); }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 md:w-full text-left ${
                  activeTab === "contacts" 
                    ? "bg-indigo-600/10 text-indigo-300 border border-indigo-500/20" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                }`}
              >
                <User className="w-4 h-4 shrink-0" />
                <span>Contact</span>
              </button>
              <button
                onClick={() => { setActiveTab("history"); }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 md:w-full text-left ${
                  activeTab === "history" 
                    ? "bg-indigo-600/10 text-indigo-300 border border-indigo-500/20" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                }`}
              >
                <History className="w-4 h-4 shrink-0" />
                <span>Call History logs</span>
              </button>
              <button
                onClick={() => { setActiveTab("voice"); setSelectedCall(null); }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 md:w-full text-left ${
                  activeTab === "voice" 
                    ? "bg-indigo-600/10 text-indigo-300 border border-indigo-500/20" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                }`}
              >
                <Volume2 className="w-4 h-4 shrink-0" />
                <span>Voice</span>
              </button>
              <button
                onClick={() => { setActiveTab("settings"); setSelectedCall(null); }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 md:w-full text-left ${
                  activeTab === "settings" 
                    ? "bg-indigo-600/10 text-indigo-300 border border-indigo-500/20" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span>System Settings</span>
              </button>
            </nav>
          </div>

          <div className="hidden md:block pt-4 border-t border-white/5 space-y-2">
            <div className="bg-slate-900/50 p-2.5 rounded-xl border border-white/5">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider block">Authenticated user</span>
              <span className="text-[10px] font-bold text-slate-300 truncate block mt-0.5" title={user?.email}>
                {user?.displayName || user?.email?.split("@")[0] || "Station user"}
              </span>
              <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wider inline-block mt-1">
                {userRole}
              </span>
            </div>
            
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Close Center</span>
            </button>
          </div>
        </div>

        {/* Central interactive body */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-hidden relative">
          
          {/* Header */}
          <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-slate-950/30">
            <div>
              <h2 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                {activeTab === "contacts" && <>👥 Contact</>}
                {activeTab === "history" && <>📜 Durable Call Log Archives</>}
                {activeTab === "voice" && <>🎙️ Voice &amp; Pacing</>}
                {activeTab === "settings" && <>⚙️ System & Administrative Preferences</>}
              </h2>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">
                {activeTab === "contacts" && "Manage client profiles and quickly route calls"}
                {activeTab === "history" && "Audit deep conversation transcripts and summaries"}
                {activeTab === "voice" && "Choose your voice actor and speaking pace"}
                {activeTab === "settings" && "Tweak telemetry, performance and account properties"}
              </p>
            </div>
            
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-white/5 hover:border-white/10 hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer md:hidden"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Tab content area */}
          <div className="flex-1 overflow-y-auto p-5 md:p-6">
            
            {/* ============================================================================ */}
            {/* CONTACTS TAB */}
            {/* ============================================================================ */}
            {activeTab === "contacts" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-black/10 p-3 rounded-2xl border border-white/5">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      placeholder="Search saved contacts by name, company, or phone..."
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <button
                    onClick={() => setIsAddingContact(!isAddingContact)}
                    className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      isAddingContact 
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                        : "bg-indigo-600/10 border-indigo-500/25 text-indigo-300 hover:bg-indigo-600/20"
                    }`}
                  >
                    <Plus className={`w-4 h-4 transition-transform ${isAddingContact ? "rotate-45" : ""}`} />
                    <span>{isAddingContact ? "Cancel" : "Add Contact"}</span>
                  </button>
                </div>

                {isAddingContact && (
                  <form onSubmit={handleContactSubmit} className="bg-slate-950/50 border border-indigo-500/15 rounded-2xl p-4 space-y-4 shadow-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1.5">Full Name *</label>
                        <input
                          type="text"
                          required
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Dr. Emily Thorne"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1.5">Company / Org</label>
                        <input
                          type="text"
                          value={newCompany}
                          onChange={(e) => setNewCompany(e.target.value)}
                          placeholder="Global Neuro Center"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1.5">Phone Number</label>
                        <input
                          type="tel"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          placeholder="+1 415-555-2671"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1.5">Internal Client Notes</label>
                        <input
                          type="text"
                          value={newNotes}
                          onChange={(e) => setNewNotes(e.target.value)}
                          placeholder="Prefers Samantha voice, talks about strategic metrics..."
                          className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={contactSaving}
                      className="w-full bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {contactSaving ? "Saving contact profile..." : "Save Contact Profile"}
                    </button>
                  </form>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredContacts.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-500 text-xs italic bg-slate-950/20 border border-white/5 rounded-2xl">
                      No matching contact profiles found in directory.
                    </div>
                  ) : (
                    filteredContacts.map((contact) => {
                      const isSelected = selectedContactId === contact.id;
                      const initials = contact.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                      return (
                        <div
                          key={contact.id}
                          onClick={() => onSelectContact(isSelected ? null : contact.id)}
                          className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex items-start justify-between gap-3 group relative overflow-hidden ${
                            isSelected
                              ? "bg-indigo-600/15 border-indigo-500/40 ring-1 ring-indigo-500/10 shadow-lg shadow-indigo-500/5"
                              : "bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/30"
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Avatar circle */}
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 select-none ${
                              isSelected 
                                ? "bg-indigo-500 text-white shadow shadow-indigo-500/20" 
                                : "bg-white/5 text-slate-300"
                            }`}>
                              {initials || "U"}
                            </div>
                            
                            <div className="min-w-0 space-y-1">
                              <span className="font-extrabold text-xs text-white block truncate">
                                {contact.name}
                              </span>
                              
                              <div className="flex flex-col gap-0.5 text-[9px] font-mono text-slate-500">
                                {contact.company && (
                                  <span className="flex items-center gap-1 truncate text-slate-400">
                                    <Building className="w-3 h-3 text-slate-600 shrink-0" />
                                    {contact.company}
                                  </span>
                                )}
                                {contact.phone && (
                                  <span className="flex items-center gap-1 truncate font-semibold">
                                    <Phone className="w-3 h-3 text-slate-600 shrink-0" />
                                    {contact.phone}
                                  </span>
                                )}
                              </div>

                              {contact.notes && (
                                <p className="text-[10px] text-slate-400 leading-normal line-clamp-1 italic mt-1 bg-white/[0.01] px-1.5 py-0.5 rounded border border-white/[0.02]">
                                  "{contact.notes}"
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {isSelected && (
                              <span className="bg-emerald-500/10 text-emerald-400 text-[8px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest block">
                                Target
                              </span>
                            )}
                            
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm(`Delete the saved contact record of "${contact.name}"?`)) {
                                  await onDeleteContact(contact.id);
                                  if (isSelected) onSelectContact(null);
                                }
                              }}
                              className="p-1 text-slate-600 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Delete Contact Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Full conversation archive for the selected contact -- every call
                    with this person lives here, not just the most recent one. Clicking
                    a past call jumps to its full transcript in the History tab. The AI's
                    actual "remembers last call" behavior is handled separately, server-side,
                    and keeps working unchanged regardless of this view. */}
                {selectedContactId && (
                  <div className="bg-black/20 border border-white/5 rounded-2xl p-4 space-y-2">
                    <span className="text-[9px] font-mono font-bold text-slate-500 uppercase flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3 text-indigo-400" />
                      Conversation History
                      {contactConversationHistory.length > 0 && (
                        <span className="ml-auto text-slate-600 normal-case font-normal">
                          {contactConversationHistory.length} call{contactConversationHistory.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </span>
                    {contactConversationHistory.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic">No previous calls with this contact yet.</p>
                    ) : (
                      <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                        {contactConversationHistory.map((call) => (
                          <button
                            key={call.id}
                            onClick={() => {
                              setSelectedCall(call);
                              setActiveTab("history");
                            }}
                            className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-600/5 transition-all text-left cursor-pointer group"
                          >
                            <div className="min-w-0">
                              <p className="text-[11px] text-slate-300 font-medium font-mono truncate">
                                {new Date(call.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                              </p>
                              <p className="text-[9px] text-slate-500 mt-0.5">
                                {formatDuration(call.duration_seconds)} • {call.selected_voice}
                                {call.status !== "completed" && (
                                  <span className="text-amber-400 ml-1.5 uppercase">{call.status}</span>
                                )}
                              </p>
                            </div>
                            <span className="text-[9px] text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0 font-mono">
                              View →
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-[9px] text-slate-600 italic pt-1">
                      The AI automatically recalls your last conversation with this contact on the next call.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================================ */}
            {/* CALL HISTORY TAB */}
            {/* ============================================================================ */}
            {activeTab === "history" && (
              <div className="space-y-4">
                
                {selectedCall ? (
                  /* Expand view details of single call log */
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setSelectedCall(null)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-all font-bold flex items-center gap-1 cursor-pointer"
                      >
                        ← Back to Archives
                      </button>

                      {/* Export buttons */}
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-slate-500 uppercase">Export Single Log:</span>
                        <button
                          onClick={() => {
                            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedCall, null, 2));
                            const link = document.createElement("a");
                            link.setAttribute("href", dataStr);
                            link.setAttribute("download", `responsive_ai_call_${selectedCall.id}.json`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all text-[10px] font-mono flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>JSON</span>
                        </button>
                      </div>
                    </div>

                    {/* Metadata summary */}
                    <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div>
                          <span className="text-[8px] font-mono text-slate-500 uppercase block">Contact Link</span>
                          <span className="text-sm font-extrabold text-white block">
                            {selectedCall.contact_name || "Anonymous Caller"}
                          </span>
                          {selectedCall.contact_company && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {selectedCall.contact_company}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-[8px] font-mono text-slate-500 uppercase block">Date & Timestamp</span>
                          <span className="text-[11px] text-slate-300 font-medium">
                            {formatDate(selectedCall.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center border-t sm:border-t-0 sm:border-l border-white/5 pt-3 sm:pt-0 sm:pl-4">
                        <div className="flex flex-col justify-center">
                          <span className="text-[8px] font-mono text-slate-500 uppercase block">Voice Actor</span>
                          <span className="text-xs font-bold text-indigo-300 block mt-0.5">
                            {selectedCall.selected_voice}
                          </span>
                        </div>
                        <div className="flex flex-col justify-center">
                          <span className="text-[8px] font-mono text-slate-500 uppercase block">Duration</span>
                          <span className="text-xs font-bold text-slate-200 block mt-0.5">
                            {formatDuration(selectedCall.duration_seconds)}
                          </span>
                        </div>
                        <div className="flex flex-col justify-center">
                          <span className="text-[8px] font-mono text-slate-500 uppercase block">Persona Style</span>
                          <span className="text-xs font-bold text-amber-300 block mt-0.5 uppercase tracking-wide">
                            {selectedCall.ai_personality || "Friendly"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* AI extracted notes */}
                    {selectedCall.ai_notes && (
                      <div className="bg-indigo-950/20 border border-indigo-500/10 rounded-2xl p-4 space-y-1.5">
                        <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-widest block font-bold">
                          AI Co-Pilot Extracted Notes & Summary
                        </span>
                        <p className="text-xs text-slate-200 leading-relaxed italic bg-black/10 p-3 rounded-xl border border-indigo-500/5">
                          "{selectedCall.ai_notes}"
                        </p>
                      </div>
                    )}

                    {/* Transcript bubbles */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-indigo-400" />
                        Conversation Transcript Logs
                      </h4>

                      <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 max-h-[280px] overflow-y-auto space-y-3.5 scrollbar-thin">
                        {transcriptLoading ? (
                          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-2" />
                            <span className="text-[10px] font-mono uppercase tracking-wider">Retrieving Secure Log Nodes...</span>
                          </div>
                        ) : transcript.length === 0 ? (
                          <p className="text-xs italic text-slate-600 font-mono text-center py-8">
                            No transcript stream exists for this call.
                          </p>
                        ) : (
                          transcript.map((msg, i) => {
                            const isUser = msg.speaker === "User";
                            return (
                              <div 
                                key={i} 
                                className={`flex flex-col space-y-1 max-w-[85%] ${isUser ? "ml-auto items-end" : "mr-auto items-start"}`}
                              >
                                <span className="text-[9px] font-mono text-slate-500">
                                  {msg.speaker} • {formatDate(msg.timestamp).split(",")[1] || "Just now"}
                                </span>
                                <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                                  isUser 
                                    ? "bg-indigo-600/20 text-indigo-100 rounded-tr-none border border-indigo-500/15" 
                                    : "bg-white/[0.04] text-slate-200 rounded-tl-none border border-white/5"
                                }`}>
                                  {msg.message}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* History List Screen with filters and search */
                  <div className="space-y-4">
                    <div className="bg-black/10 p-4 rounded-2xl border border-white/5 space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={historySearch}
                          onChange={(e) => setHistorySearch(e.target.value)}
                          placeholder="Search archives by contact name, company, persona, or voice..."
                          className="w-full bg-slate-950/80 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-slate-500">VOICE:</span>
                            <select
                              value={voiceFilter}
                              onChange={(e) => setVoiceFilter(e.target.value)}
                              className="bg-slate-950 border border-white/10 rounded-lg py-1 px-2.5 text-[10px] font-bold text-slate-300 focus:outline-none"
                            >
                              <option value="all">All Actors</option>
                              {Array.from(new Set(calls.map(c => c.selected_voice))).map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-slate-500">SORT:</span>
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as any)}
                              className="bg-slate-950 border border-white/10 rounded-lg py-1 px-2.5 text-[10px] font-bold text-slate-300 focus:outline-none"
                            >
                              <option value="newest">Newest First</option>
                              <option value="oldest">Oldest First</option>
                              <option value="longest">Longest Duration</option>
                              <option value="shortest">Shortest Duration</option>
                            </select>
                          </div>
                        </div>

                        {/* Export actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={exportLogsToCSV}
                            title="Export all filtered logs as CSV"
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold text-slate-300 flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Export CSV</span>
                          </button>
                          <button
                            onClick={exportLogsToJSON}
                            title="Export all filtered logs as JSON"
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold text-slate-300 flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Export JSON</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Archives Table / List */}
                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto scrollbar-thin pr-1">
                      {filteredCalls.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 text-xs italic bg-slate-950/20 border border-white/5 rounded-2xl">
                          No historical call logs found in system database.
                        </div>
                      ) : (
                        filteredCalls.map((call) => {
                          const initials = call.contact_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "A";
                          return (
                            <div
                              key={call.id}
                              onClick={() => setSelectedCall(call)}
                              className="p-3.5 bg-black/15 hover:bg-black/25 border border-white/5 hover:border-white/10 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
                            >
                              <div className="flex items-center gap-3">
                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/5 flex items-center justify-center font-bold text-[11px] text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-extrabold text-xs text-white block">
                                    {call.contact_name || "Anonymous Caller"}
                                  </span>
                                  <div className="flex items-center gap-2 mt-0.5 text-[9px] font-mono text-slate-500">
                                    <span>{formatDate(call.created_at)}</span>
                                    <span>•</span>
                                    <span className="text-slate-400 bg-white/5 px-1.5 py-0.5 rounded uppercase">
                                      {call.selected_voice}
                                    </span>
                                    {call.ai_personality && (
                                      <>
                                        <span>•</span>
                                        <span className="text-amber-400 font-semibold">{call.ai_personality}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                                <div className="text-right font-mono">
                                  <span className="block text-xs font-bold text-slate-300">
                                    {formatDuration(call.duration_seconds)}
                                  </span>
                                  <span className="text-[9px] text-slate-500 block uppercase font-bold">
                                    {call.status}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================================ */}
            {/* AI CONFIGURATION TAB */}
            {/* ============================================================================ */}
            {activeTab === "voice" && (
              <div className="space-y-6">

                {/* 1. Voice Swapper Options */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-indigo-400" />
                      1. Active Voice Actor
                    </h3>
                    <span className="text-[9px] font-mono text-slate-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/25">
                      Current: {VOICES.find(v => v.id === selectedVoice)?.name || selectedVoice}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {VOICES.map((v) => {
                      const isSelected = selectedVoice === v.id;
                      return (
                        <button
                          key={v.id}
                          onClick={() => onSelectVoice(v.id)}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-[90px] cursor-pointer group ${
                            isSelected
                              ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-200"
                              : "bg-black/15 border-white/5 text-slate-400 hover:border-white/10"
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-extrabold text-[11px] text-white block truncate group-hover:text-indigo-300 transition-all">
                              {v.name}
                            </span>
                            <span className="text-[9px] text-slate-500 block truncate mt-0.5 font-mono">
                              {v.gender} • {v.style.split("&")[0]}
                            </span>
                          </div>

                          <div className="flex items-center justify-between w-full">
                            <span className="text-[9px] text-slate-400">
                              {v.actor.split(" ").pop()}
                            </span>
                            {isSelected && (
                              <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white scale-90">
                                <Check className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Speed Preferences */}
                <div className="space-y-3 pt-5 border-t border-white/5 bg-black/10 -mx-5 -mb-5 p-5 rounded-b-2xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-slate-400" />
                      2. Speech Rate Pacing
                    </h3>
                    <span className="text-xs font-extrabold text-indigo-400 font-mono">{aiSpeed.toFixed(1)}x Speed</span>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={aiSpeed}
                      onChange={(e) => setAiSpeed(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-950 border border-white/5 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                      <span>0.5x (Slow / Crisp)</span>
                      <span>1.0x (Standard / Paced)</span>
                      <span>2.0x (Maximum Speed)</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ============================================================================ */}
            {/* SETTINGS TAB */}
            {/* ============================================================================ */}
            {activeTab === "settings" && (
              <div className="space-y-5">
                
                {/* System Toggles */}
                <div className="bg-slate-950/20 border border-white/5 rounded-2xl p-4 space-y-4">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-2">
                    <Activity className="w-4 h-4 text-slate-400" />
                    Interactive Client Settings
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">Sound alerts & cues</span>
                        <span className="text-[10px] text-slate-500 leading-normal block">Play audible tones when call connects or end is triggered</span>
                      </div>
                      <button
                        onClick={() => setAlertsEnabled(!alertsEnabled)}
                        className={`w-10 h-6 rounded-full transition-all flex items-center p-0.5 cursor-pointer ${
                          alertsEnabled ? "bg-indigo-500 justify-end" : "bg-slate-800 justify-start"
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-white shadow-md block" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.03]">
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">Continuous listening</span>
                        <span className="text-[10px] text-slate-500 leading-normal block">Stay in listening mode until caller ends verbal turn</span>
                      </div>
                      <button
                        onClick={() => setContinuousListening(!continuousListening)}
                        className={`w-10 h-6 rounded-full transition-all flex items-center p-0.5 cursor-pointer ${
                          continuousListening ? "bg-indigo-500 justify-end" : "bg-slate-800 justify-start"
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-white shadow-md block" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.03]">
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">High Performance Rendering</span>
                        <span className="text-[10px] text-slate-500 leading-normal block">Enable intense visualizer waveforms and glow effects</span>
                      </div>
                      <button
                        onClick={() => setHighPerformanceMode(!highPerformanceMode)}
                        className={`w-10 h-6 rounded-full transition-all flex items-center p-0.5 cursor-pointer ${
                          highPerformanceMode ? "bg-indigo-500 justify-end" : "bg-slate-800 justify-start"
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-white shadow-md block" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.03]">
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">Save AI command logs</span>
                        <span className="text-[10px] text-slate-500 leading-normal block">Automatically append copilot commands into session summaries</span>
                      </div>
                      <button
                        onClick={() => setSaveCallNotes(!saveCallNotes)}
                        className={`w-10 h-6 rounded-full transition-all flex items-center p-0.5 cursor-pointer ${
                          saveCallNotes ? "bg-indigo-500 justify-end" : "bg-slate-800 justify-start"
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-white shadow-md block" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* About Panel */}
                <div className="bg-slate-950/40 p-4 border border-white/5 rounded-2xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-500 shrink-0">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div className="text-[10px] text-slate-500 leading-normal">
                    Responsive AI Duplex Station Hub. Utilizing direct secure WebSocket streaming over low latency lanes. Built on React 18 & Tailwind CSS. All rights reserved.
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Footer controls for mobile */}
          <div className="p-4 border-t border-white/5 bg-slate-950 flex items-center justify-end md:hidden shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 text-white font-extrabold rounded-xl text-xs shadow-md transition-all cursor-pointer"
            >
              Done
            </button>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
