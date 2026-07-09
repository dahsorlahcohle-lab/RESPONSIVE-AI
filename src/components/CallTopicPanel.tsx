import React, { useState } from "react";
import { MessageSquare, Send, CheckCircle2 } from "lucide-react";

interface CallTopicPanelProps {
  value: string;
  onChange: (value: string) => void;
  /** True when rendered inside an active live call (adds the "send now" action). */
  isLive: boolean;
  /** Pushes the current text straight into the live Gemini session. Only used when isLive. */
  onSendLive: (text: string) => void;
  /** Tighter footprint for the main pre-call dial screen (shorter box, no subtitle). */
  compact?: boolean;
}

// Single shared "what should the AI talk about" box. Rendered in two places:
// 1. Pre-call, inside AI Persona Configuration Core (ThreeDotMenuModal) -- here it just
//    holds the value, which gets folded into the AI's instructions the next time a call starts.
// 2. Live, inside an active call (replacing the old non-functional "AI Command Panel") --
//    here submitting actually pushes the text into the live Gemini session in real time via
//    a "live_directive" WS message, so the AI genuinely reacts to it moments later.
export default function CallTopicPanel({ value, onChange, isLive, onSendLive, compact = false }: CallTopicPanelProps) {
  const [justSent, setJustSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLive || !value.trim()) return;
    onSendLive(value.trim());
    setJustSent(true);
    setTimeout(() => setJustSent(false), 1500);
  };

  return (
    <div className={`bg-slate-900/40 border border-white/5 rounded-3xl backdrop-blur-md flex flex-col ${compact ? "p-3.5" : "p-5 h-full min-h-[400px]"}`}>
      {!compact && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            Call Topic & Talking Points
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isLive
              ? "Type what you want the AI to talk about right now -- it steers the live conversation immediately."
              : "Set what you want the AI to talk about before the call starts."}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-2.5">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Ask about the trip to Lisbon, then bring up next week's deadline..."
          className={`flex-1 w-full bg-black/30 border border-white/10 rounded-2xl p-3 text-xs text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none focus:border-indigo-500/40 ${compact ? "min-h-[70px]" : "min-h-[140px]"}`}
        />

        {isLive && (
          <button
            type="submit"
            disabled={!value.trim()}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              justSent
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {justSent ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Sent to AI
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send to AI Now
              </>
            )}
          </button>
        )}

        {!isLive && !compact && (
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
            Saved automatically -- applies to your next call
          </p>
        )}
      </form>
    </div>
  );
}
