import React, { useState } from "react";
import { Terminal, Play, Sparkles, Plus, AlertCircle, CheckCircle2 } from "lucide-react";

interface AICommandLog {
  id: string;
  command: string;
  timestamp: string;
  status: "executing" | "completed" | "failed";
}

interface AiCommandModeProps {
  callSessionId: string | null;
  authToken: string;
  onLogCommand?: (cmd: string) => void;
}

export default function AiCommandMode({
  callSessionId,
  authToken,
  onLogCommand
}: AiCommandModeProps) {
  const [customCommand, setCustomCommand] = useState("");
  const [activeCommands, setActiveCommands] = useState<string[]>([]);
  const [commandLogs, setCommandLogs] = useState<AICommandLog[]>([]);

  const triggerCommand = async (cmd: string) => {
    const logId = Math.random().toString(36).substring(2, 9);
    const newLog: AICommandLog = {
      id: logId,
      command: cmd,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      status: "executing"
    };

    setCommandLogs(prev => [newLog, ...prev]);

    // Send command execution to server (associated with active call if exists)
    if (callSessionId) {
      try {
        const response = await fetch(`/api/calls/${callSessionId}/commands`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify({ command: cmd })
        });
        const data = await response.json();
        if (data.success) {
          // Successfully logged, let's mark as completed after a slight visual delay
          setTimeout(() => {
            setCommandLogs(prev => prev.map(log => log.id === logId ? { ...log, status: "completed" } : log));
            if (onLogCommand) onLogCommand(cmd);
          }, 1200);
        } else {
          setCommandLogs(prev => prev.map(log => log.id === logId ? { ...log, status: "failed" } : log));
        }
      } catch (err) {
        console.error("Failed to log command execution:", err);
        setCommandLogs(prev => prev.map(log => log.id === logId ? { ...log, status: "failed" } : log));
      }
    } else {
      // Offline/simulation trigger
      setTimeout(() => {
        setCommandLogs(prev => prev.map(log => log.id === logId ? { ...log, status: "completed" } : log));
        if (onLogCommand) onLogCommand(cmd);
      }, 1200);
    }
  };

  const addCustomCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCommand.trim()) return;
    setActiveCommands(prev => [...prev, customCommand.trim()]);
    setCustomCommand("");
  };

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-5 backdrop-blur-md flex flex-col h-full min-h-[400px]">
      {/* Title */}
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-400" />
          AI Command Panel (Co-Pilot)
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">Inject dynamic directives into live calls</p>
      </div>

      {/* Preset Command Deck */}
      <div className="space-y-2 flex-1">
        <span className="text-[9px] font-mono font-bold text-slate-500 block uppercase">Directive Library</span>
        <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto scrollbar-thin pr-1">
          {activeCommands.map((cmd, index) => (
            <button
              key={index}
              onClick={() => triggerCommand(cmd)}
              className="p-2.5 rounded-xl bg-black/30 border border-white/5 hover:border-white/10 text-left hover:bg-black/40 text-xs text-slate-300 transition-all flex items-center justify-between gap-2 group cursor-pointer"
            >
              <span className="truncate flex-1 font-medium">{cmd}</span>
              <span className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                <Play className="w-3 h-3 fill-current" />
              </span>
            </button>
          ))}
        </div>

        {/* Custom command addition */}
        <form onSubmit={addCustomCommand} className="flex gap-2 pt-2">
          <input
            type="text"
            value={customCommand}
            onChange={(e) => setCustomCommand(e.target.value)}
            placeholder="Add custom custom directive..."
            className="flex-1 bg-slate-950/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>
      </div>

      {/* Live Directives Feed / Console Logs */}
      <div className="mt-4 pt-4 border-t border-white/5 flex-1 flex flex-col min-h-[140px]">
        <span className="text-[9px] font-mono font-bold text-slate-500 block uppercase mb-2">Duplex Commands Stream</span>
        <div className="flex-1 bg-slate-950/80 border border-white/10 rounded-2xl p-3 font-mono text-[10px] space-y-1.5 overflow-y-auto max-h-[150px] scrollbar-thin">
          {commandLogs.length === 0 ? (
            <div className="text-slate-600 italic text-center py-6">
              Awaiting directive execution...
            </div>
          ) : (
            commandLogs.map(log => (
              <div key={log.id} className="flex items-start gap-1.5 leading-normal pb-1 last:pb-0">
                <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                {log.status === "executing" && (
                  <span className="text-amber-400 shrink-0 animate-pulse font-bold">[EXEC...]</span>
                )}
                {log.status === "completed" && (
                  <span className="text-emerald-400 shrink-0 font-bold">[ OK ]</span>
                )}
                {log.status === "failed" && (
                  <span className="text-rose-400 shrink-0 font-bold">[FAIL]</span>
                )}
                <span className="text-slate-300 break-all">{log.command}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
