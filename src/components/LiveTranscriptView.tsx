import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Mic, Cpu, Save, AlertCircle } from "lucide-react";

export interface TranscriptMessage {
  speaker: "User" | "AI";
  message: string;
  timestamp: string;
}

interface LiveTranscriptViewProps {
  isActive: boolean;
  currentAiText: string;
  callSessionId: string | null;
  authToken: string;
  onSaveCompleted?: (messages: TranscriptMessage[]) => void;
}

export default function LiveTranscriptView({
  isActive,
  currentAiText,
  callSessionId,
  authToken,
  onSaveCompleted
}: LiveTranscriptViewProps) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentAiText]);

  // Set up Web Speech API Speech Recognition for User voice transcription
  useEffect(() => {
    if (!isActive) {
      // If call is not active, clean up recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported in this browser. User transcriptions will not be recorded.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onresult = (event: any) => {
        const lastResultIndex = event.resultIndex;
        const resultText = event.results[lastResultIndex]?.[0]?.transcript?.trim();
        
        if (resultText) {
          const userMsg: TranscriptMessage = {
            speaker: "User",
            message: resultText,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, userMsg]);
        }
      };

      rec.onerror = (err: any) => {
        console.error("Speech recognition error:", err);
      };

      rec.onend = () => {
        // Automatically restart if call is still active
        if (isActive && recognitionRef.current) {
          try { rec.start(); } catch (e) {}
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
    }

    // Reset messages for the new call session
    setMessages([]);

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, [isActive]);

  // Append AI message when it completes speaking
  const prevAiTextRef = useRef("");
  useEffect(() => {
    if (!isActive) {
      prevAiTextRef.current = "";
      return;
    }

    // If currentAiText becomes empty and we had text previously, it means the model turn completed!
    if (!currentAiText && prevAiTextRef.current) {
      const aiMsg: TranscriptMessage = {
        speaker: "AI",
        message: prevAiTextRef.current,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMsg]);
      prevAiTextRef.current = "";
    } else if (currentAiText) {
      prevAiTextRef.current = currentAiText;
    }
  }, [currentAiText, isActive]);

  // Trigger automatic saving to server when call ends
  useEffect(() => {
    // When isActive transitions from true to false, and we have messages logged, save them!
    if (!isActive && messages.length > 0 && callSessionId) {
      const saveTranscript = async () => {
        try {
          await fetch(`/api/calls/${callSessionId}/transcript`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ messages })
          });
          if (onSaveCompleted) {
            onSaveCompleted(messages);
          }
        } catch (err) {
          console.error("Failed to automatically save transcripts:", err);
        }
      };
      saveTranscript();
    }
  }, [isActive, messages, callSessionId, authToken, onSaveCompleted]);

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-5 backdrop-blur-md flex flex-col h-full min-h-[400px]">
      {/* Title */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            Live Duplex Conversation Transcript
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Real-time side-by-side voice transcribing</p>
        </div>
        {isActive && (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
        )}
      </div>

      {/* Transcript Screen */}
      <div className="flex-1 bg-black/35 border border-white/10 rounded-2xl p-4 overflow-y-auto max-h-[280px] space-y-4 scrollbar-thin">
        {messages.length === 0 && !currentAiText ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-600 text-xs italic py-12 font-mono">
            {isActive ? (
              <p className="animate-pulse">Awaiting speech. Speak naturally into your microphone...</p>
            ) : (
              <p>Start a voice call to generate real-time transcript.</p>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const isUser = msg.speaker === "User";
              return (
                <div
                  key={index}
                  className={`flex flex-col space-y-1 max-w-[85%] ${
                    isUser ? "ml-auto items-end" : "mr-auto items-start"
                  }`}
                >
                  <div className="flex items-center gap-1 text-[9px] font-mono text-slate-500 font-bold uppercase">
                    {isUser ? (
                      <>
                        <span>You</span>
                        <Mic className="w-2.5 h-2.5 text-emerald-400" />
                      </>
                    ) : (
                      <>
                        <Cpu className="w-2.5 h-2.5 text-indigo-400" />
                        <span>AI Companion</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{formatTime(msg.timestamp)}</span>
                  </div>
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? "bg-indigo-600/15 text-indigo-100 rounded-tr-none border border-indigo-500/20"
                        : "bg-white/[0.04] text-slate-200 rounded-tl-none border border-white/5"
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              );
            })}

            {/* Live Streaming Text of AI companion responding */}
            {currentAiText && (
              <div className="flex flex-col space-y-1 max-w-[85%] mr-auto items-start">
                <div className="flex items-center gap-1 text-[9px] font-mono text-indigo-400 font-bold uppercase animate-pulse">
                  <Cpu className="w-2.5 h-2.5" />
                  <span>AI Companon is speaking...</span>
                </div>
                <div className="p-3 rounded-2xl text-xs leading-relaxed bg-white/[0.04] text-slate-200 rounded-tl-none border border-indigo-500/10 animate-pulse">
                  {currentAiText}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Transcript Info Panel */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5 font-mono">
          <AlertCircle className="w-3.5 h-3.5 text-indigo-400" />
          Auto-saves to database when call finishes
        </span>
        <span className="font-bold font-mono">
          {messages.length} Utterances logged
        </span>
      </div>
    </div>
  );
}
