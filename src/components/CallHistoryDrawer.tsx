import React, { useState, useEffect } from "react";
import { 
  History, Search, SortDesc, SortAsc, Calendar, Clock, Sparkles, 
  User, CheckCircle2, ChevronRight, MessageSquare, Terminal, Eye, X 
} from "lucide-react";

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
}

interface TranscriptMessage {
  speaker: "User" | "AI";
  message: string;
  timestamp: string;
}

interface CallHistoryDrawerProps {
  calls: CallSession[];
  authToken: string;
  onClose: () => void;
}

export default function CallHistoryDrawer({
  calls,
  authToken,
  onClose
}: CallHistoryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [voiceFilter, setVoiceFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "longest" | "shortest">("newest");
  const [selectedCall, setSelectedCall] = useState<CallSession | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  // Fetch full transcript when a call is expanded
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

  // Unique list of voices used
  const voicesUsed = ["all", ...Array.from(new Set(calls.map(c => c.selected_voice)))];

  // Filtering and Sorting
  const filteredCalls = calls
    .filter(c => {
      const query = searchQuery.toLowerCase();
      const nameMatch = c.contact_name?.toLowerCase().includes(query) || false;
      const companyMatch = c.contact_company?.toLowerCase().includes(query) || false;
      const voiceMatch = c.selected_voice.toLowerCase().includes(query);
      const searchOk = nameMatch || companyMatch || voiceMatch || query === "";

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

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-slate-950 border-l border-white/10 shadow-2xl flex flex-col z-50 overflow-hidden font-sans">
      
      {/* Header Panel */}
      <div className="p-5 border-b border-white/5 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <History className="w-4 h-4 text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Durable Call Sessions</h2>
            <p className="text-[10px] text-slate-500 font-mono">DURABLE LOGS & LIVE AUDITING</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {selectedCall ? (
        /* ==================== CALL DETAIL SCREEN ==================== */
        <div className="flex-1 overflow-y-auto flex flex-col p-5 space-y-5">
          <button
            onClick={() => setSelectedCall(null)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-all font-semibold flex items-center gap-1 cursor-pointer self-start"
          >
            ← Back to Call List
          </button>

          {/* Quick Stats Grid */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono text-slate-500 uppercase">Contact Link</span>
                <span className="block text-sm font-extrabold text-white">
                  {selectedCall.contact_name || "Anonymous Caller"}
                </span>
                {selectedCall.contact_company && (
                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                    {selectedCall.contact_company}
                  </span>
                )}
              </div>
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-mono px-2.5 py-1 rounded-full border border-emerald-500/20 capitalize">
                {selectedCall.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-white/5 text-center">
              <div>
                <span className="text-[9px] font-mono text-slate-500 block">VOICE</span>
                <span className="text-xs font-bold text-indigo-300">{selectedCall.selected_voice}</span>
              </div>
              <div>
                <span className="text-[9px] font-mono text-slate-500 block">DURATION</span>
                <span className="text-xs font-bold text-slate-200">{formatDuration(selectedCall.duration_seconds)}</span>
              </div>
              <div>
                <span className="text-[9px] font-mono text-slate-500 block">TIME</span>
                <span className="text-xs font-bold text-slate-400">{formatDate(selectedCall.created_at).split(",")[0]}</span>
              </div>
            </div>
          </div>

          {/* AI Notes / Commands Log */}
          {selectedCall.ai_notes && (
            <div className="bg-indigo-950/20 border border-indigo-500/10 rounded-2xl p-4">
              <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-widest block mb-1">AI Generated Summary</span>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                "{selectedCall.ai_notes}"
              </p>
            </div>
          )}

          {/* Transcripts List */}
          <div className="flex-1 flex flex-col min-h-[250px]">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              Full Side-By-Side Conversation Transcript
            </h4>

            <div className="flex-1 bg-black/30 border border-white/5 rounded-2xl p-4 overflow-y-auto max-h-[350px] space-y-3.5 scrollbar-thin">
              {transcriptLoading ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-slate-500">
                  <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-[10px] font-mono">Retransmitting duplex voice transcript...</span>
                </div>
              ) : transcript.length === 0 ? (
                <p className="text-xs italic text-slate-600 font-mono text-center py-8">
                  No speech log generated for this session.
                </p>
              ) : (
                transcript.map((msg, i) => {
                  const isUser = msg.speaker === "User";
                  return (
                    <div 
                      key={i} 
                      className={`flex flex-col space-y-1 max-w-[85%] ${isUser ? "ml-auto items-end" : "mr-auto items-start"}`}
                    >
                      <div className="flex items-center gap-1 text-[9px] font-mono text-slate-500">
                        <span>{msg.speaker}</span>
                        <span>•</span>
                        <span>{formatDate(msg.timestamp).split(",")[1] || "Just now"}</span>
                      </div>
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
        /* ==================== HISTORY LIST SCREEN ==================== */
        <div className="flex-1 flex flex-col p-5 overflow-hidden">
          
          {/* Controls Box */}
          <div className="space-y-3 mb-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search link, client, or active voice..."
                className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Sort & Voice Filters */}
            <div className="flex gap-2.5">
              <div className="flex-1">
                <span className="text-[8px] font-mono text-slate-500 block mb-1">SORT HISTORY</span>
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="w-full bg-slate-900 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="longest">Longest Duration</option>
                  <option value="shortest">Shortest Duration</option>
                </select>
              </div>

              <div className="flex-1">
                <span className="text-[8px] font-mono text-slate-500 block mb-1">FILTER VOICE</span>
                <select
                  value={voiceFilter}
                  onChange={(e) => setVoiceFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer capitalize"
                >
                  {voicesUsed.map(voice => (
                    <option key={voice} value={voice}>{voice === "all" ? "All Voices" : voice}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* List panel */}
          <div className="flex-1 overflow-y-auto space-y-2.5 scrollbar-thin">
            {filteredCalls.length === 0 ? (
              <div className="text-center py-12 text-slate-600 text-xs font-mono italic">
                No archived voice sessions matched search critera.
              </div>
            ) : (
              filteredCalls.map((call) => (
                <div
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-100 truncate block">
                        {call.contact_name || "Anonymous Caller"}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500 shrink-0">
                        {formatDate(call.created_at).split(",")[0]}
                      </span>
                    </div>

                    <div className="flex items-center gap-3.5 text-[10px] font-mono text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                        {formatDuration(call.duration_seconds)}
                      </span>
                      <span className="flex items-center gap-1 bg-indigo-500/5 px-2 py-0.5 rounded text-indigo-400 text-[9px] border border-indigo-500/10">
                        Voice: {call.selected_voice}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5 shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-white/5 bg-slate-900/40 text-center text-[10px] text-slate-500 font-mono">
        Secured encrypted session storage
      </div>
    </div>
  );
}
