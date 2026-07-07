import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Volume2, 
  VolumeX, 
  Play, 
  Square,
  Check, 
  X, 
  Sparkles, 
  Mic, 
  UserRound,
  Info
} from "lucide-react";
import { VoiceOption } from "../App";

interface VoiceSelectionModalProps {
  currentVoiceId: string;
  voices: VoiceOption[];
  onSave: (voiceId: string) => void;
  onClose: () => void;
}

const ACCENT_MAPPING: Record<string, string> = {
  Kore: "American (West Coast)",
  Charon: "Resonant American",
  Puck: "Canadian-American",
  Fenrir: "British (Gravelly)",
  Aoede: "American (Expressive)",
  Zephyr: "Southern American",
  Orion: "American (Earnest)",
  Ursa: "Mid-Atlantic / Elegant",
  Capella: "American (Energetic)"
};

export default function VoiceSelectionModal({
  currentVoiceId,
  voices,
  onSave,
  onClose
}: VoiceSelectionModalProps) {
  const [selectedId, setSelectedId] = useState<string>(currentVoiceId);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playTimerRef = useRef<number | null>(null);

  // Sync state with prop if it changes
  useEffect(() => {
    setSelectedId(currentVoiceId);
  }, [currentVoiceId]);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
      }
    };
  }, []);

  const handleTogglePreview = (voice: VoiceOption, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection from changing immediately if desired

    if (playingId === voice.id) {
      // Stop playing
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setPlayingId(null);
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
      }
    } else {
      // Start playing
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setPlayingId(voice.id);

      // Attempt Speech Synthesis Playback
      try {
        const utterance = new SpeechSynthesisUtterance(voice.samplePhrase);
        const synthVoices = window.speechSynthesis.getVoices();
        
        // Find best match for gender / style
        let matchedVoice = null;
        if (voice.gender === "Female") {
          matchedVoice = synthVoices.find(v => 
            v.name.toLowerCase().includes("female") || 
            v.name.toLowerCase().includes("zira") || 
            v.name.toLowerCase().includes("google us english") ||
            v.name.toLowerCase().includes("samantha") || 
            v.name.toLowerCase().includes("hazel")
          );
        } else {
          matchedVoice = synthVoices.find(v => 
            v.name.toLowerCase().includes("male") || 
            v.name.toLowerCase().includes("david") || 
            v.name.toLowerCase().includes("google uk english") ||
            v.name.toLowerCase().includes("mark") || 
            v.name.toLowerCase().includes("ravi")
          );
        }

        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }
        
        utterance.rate = 0.95; // Slightly slower for crisp pacing
        utterance.onend = () => {
          setPlayingId(null);
        };
        utterance.onerror = () => {
          setPlayingId(null);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("Speech synthesis error or blocked by policy:", err);
      }

      // Safety timer to stop the animation and playing state in case speech ends or is blocked
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
      }
      playTimerRef.current = window.setTimeout(() => {
        setPlayingId(null);
      }, 7000); // Max 7 seconds sample play
    }
  };

  const handleSave = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    onSave(selectedId);
  };

  return (
    <div id="voice_selection_overlay" className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <motion.div
        id="voice_selection_panel"
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Volume2 className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">Select AI Voice</h3>
              <p className="text-[11px] text-slate-400">Choose a natural voice persona for your conversations</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (window.speechSynthesis) window.speechSynthesis.cancel();
              onClose();
            }}
            className="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Voice Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {voices.map((voice) => {
              const isSelected = selectedId === voice.id;
              const isPlaying = playingId === voice.id;
              const accent = ACCENT_MAPPING[voice.id] || "Global Accent";

              return (
                <div
                  key={voice.id}
                  onClick={() => setSelectedId(voice.id)}
                  className={`group relative p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between overflow-hidden h-[180px] ${
                    isSelected
                      ? "bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/30 shadow-lg shadow-indigo-500/5"
                      : "bg-slate-950/50 border-white/5 hover:border-white/10 hover:bg-slate-950/80"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Upper voice header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${voice.avatarBg} flex items-center justify-center text-xs font-black text-white shadow relative shrink-0`}>
                          {voice.name[0]}
                          {isSelected && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-white leading-none truncate">
                            {voice.name}
                          </h4>
                          <span className="text-[10px] text-indigo-300 font-medium block truncate mt-1">
                            {voice.actor}
                          </span>
                        </div>
                      </div>

                      {/* Pill info */}
                      <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                        <span className="text-[9px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {voice.gender}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {accent}
                        </span>
                      </div>
                    </div>

                    {/* Voice prompt/style description */}
                    <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                      {voice.description}
                    </p>
                  </div>

                  {/* Lower interactive section */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between mt-2">
                    <span className="text-[10px] text-slate-500 italic truncate max-w-[65%]">
                      "{voice.style}"
                    </span>

                    <button
                      onClick={(e) => handleTogglePreview(voice, e)}
                      className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                        isPlaying
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                          : "bg-indigo-500/10 border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/20"
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Square className="w-3 h-3 fill-rose-400 text-rose-400" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-indigo-300 text-indigo-300" />
                          <span>Preview</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Pulsing Visual Waveform Overlay (only active when playing this voice) */}
                  {isPlaying && (
                    <div className="absolute inset-x-0 bottom-0 h-1 flex items-end justify-center gap-[2px] px-4 pointer-events-none">
                      <div className="w-[3px] bg-indigo-400 animate-[bounce_1s_infinite_100ms] h-3"></div>
                      <div className="w-[3px] bg-indigo-400 animate-[bounce_1.2s_infinite_300ms] h-4"></div>
                      <div className="w-[3px] bg-indigo-400 animate-[bounce_0.8s_infinite_0s] h-2"></div>
                      <div className="w-[3px] bg-indigo-400 animate-[bounce_1.4s_infinite_400ms] h-5"></div>
                      <div className="w-[3px] bg-indigo-400 animate-[bounce_0.9s_infinite_200ms] h-3"></div>
                      <div className="w-[3px] bg-indigo-400 animate-[bounce_1.1s_infinite_150ms] h-4"></div>
                      <div className="w-[3px] bg-indigo-400 animate-[bounce_1.3s_infinite_350ms] h-2"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-white/5 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Saves directly to your permanent cloud profile preferences.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
            <button
              onClick={() => {
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-slate-300 font-bold hover:bg-white/10 active:scale-95 transition-all text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="w-full sm:w-auto px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-bold hover:from-indigo-500 hover:to-violet-400 active:scale-95 transition-all text-xs shadow-lg shadow-indigo-500/10 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save Voice</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
