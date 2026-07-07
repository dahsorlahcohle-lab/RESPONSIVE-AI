import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  Activity, 
  History, 
  Search, 
  UserX, 
  UserCheck, 
  BarChart3, 
  Clock, 
  RefreshCw, 
  PhoneCall, 
  AlertTriangle,
  FileText,
  Calendar,
  Lock,
  Layers
} from "lucide-react";

interface AdminConsoleProps {
  authToken: string;
  onClose: () => void;
}

export default function AdminConsole({ authToken, onClose }: AdminConsoleProps) {
  const [activeTab, setActiveTab] = useState<"users" | "calls" | "audit">("users");
  
  // Data states
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    userCount: 0,
    callCount: 0,
    totalSeconds: 0,
    activeCallsCount: 0,
    recentCalls: []
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // UI states
  const [loading, setLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null); // UID of user undergoing action
  const [error, setError] = useState<string | null>(null);

  // Fetch all admin data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Users
      const usersRes = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const usersData = await usersRes.json();
      if (usersData.success) {
        setUsers(usersData.users);
      } else {
        throw new Error(usersData.error || "Failed to fetch users");
      }

      // 2. Fetch Stats & Recent Calls
      const statsRes = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }

      // 3. Fetch Audit Logs
      const logsRes = await fetch("/api/admin/logs", {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const logsData = await logsRes.json();
      if (logsData.success) {
        setAuditLogs(logsData.logs);
      }
    } catch (err: any) {
      console.error("Admin fetch error:", err);
      setError(err.message || "Failed to load administration data");
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle suspension / deactivation of user accounts
  const handleToggleStatus = async (targetUid: string, currentStatus: string) => {
    const nextStatus = currentStatus === "suspended" ? "active" : "suspended";
    setActionLoading(targetUid);
    setError(null);

    try {
      const res = await fetch("/api/admin/user-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ targetUid, status: nextStatus })
      });
      const data = await res.json();
      
      if (data.success) {
        // Optimistic UI update or full refetch
        setUsers(prev => prev.map(u => u.uid === targetUid ? { ...u, status: nextStatus } : u));
        // Update stats recentCalls as well if modified user is inside
        setStats((prev: any) => ({
          ...prev,
          recentCalls: prev.recentCalls.map((c: any) => c.uid === targetUid ? { ...c, userStatus: nextStatus } : c)
        }));
        
        // Refresh audit logs
        const logsRes = await fetch("/api/admin/logs", {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const logsData = await logsRes.json();
        if (logsData.success) {
          setAuditLogs(logsData.logs);
        }
      } else {
        throw new Error(data.error || "Failed to update user status");
      }
    } catch (err: any) {
      console.error("User status toggle failed:", err);
      setError(err.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered users
  const filteredUsers = users.filter(u => {
    const term = userSearch.toLowerCase();
    return (
      u.email?.toLowerCase().includes(term) ||
      u.displayName?.toLowerCase().includes(term) ||
      u.uid?.toLowerCase().includes(term)
    );
  });

  // Calculate duration strings
  const formatDuration = (seconds: number) => {
    if (!seconds) return "0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full font-sans">
      
      {/* Admin Header */}
      <div className="p-6 border-b border-white/10 bg-black/40 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
              Admin Control Deck
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/20">
                Secure API
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Role-based platform audits, metrics, and compliance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
            title="Refresh logs & statistics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300 font-bold hover:bg-white/10 active:scale-95 transition-all"
          >
            Close Deck
          </button>
        </div>
      </div>

      {/* Top statistics layout */}
      <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4 border-b border-white/5 bg-black/10">
        
        {/* Total Users */}
        <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">Registered Users</span>
            <span className="block text-xl font-bold text-white mt-0.5">{stats.userCount}</span>
          </div>
        </div>

        {/* Total Calls */}
        <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">Calls Placed</span>
            <span className="block text-xl font-bold text-white mt-0.5">{stats.callCount}</span>
          </div>
        </div>

        {/* Active Calls */}
        <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">Live Calls</span>
            <span className="block text-xl font-bold text-amber-400 mt-0.5">{stats.activeCallsCount}</span>
          </div>
        </div>

        {/* Minutes logged */}
        <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">Duration Logged</span>
            <span className="block text-xl font-bold text-white mt-0.5">
              {Math.floor(stats.totalSeconds / 60)}m {stats.totalSeconds % 60}s
            </span>
          </div>
        </div>

      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-white/5 bg-black/20 px-6 gap-6 text-sm">
        <button
          onClick={() => setActiveTab("users")}
          className={`py-3.5 font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "users" ? "text-indigo-400 border-indigo-400" : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4" />
          User Accounts ({users.length})
        </button>
        <button
          onClick={() => setActiveTab("calls")}
          className={`py-3.5 font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "calls" ? "text-indigo-400 border-indigo-400" : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <History className="w-4 h-4" />
          Call Log Monitor
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`py-3.5 font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "audit" ? "text-indigo-400 border-indigo-400" : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          Admin Audits
        </button>
      </div>

      {/* Dynamic Content Panel */}
      <div className="flex-1 overflow-y-auto p-6 min-h-[350px]">
        
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2.5 text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <h5 className="font-bold">Administrative Request Failed</h5>
              <p className="mt-0.5 text-slate-400">{error}</p>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          
          {/* Tab 1: User Management */}
          {activeTab === "users" && (
            <motion.div
              key="users-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Search user block */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Filter users by name, email or account UID..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40"
                />
              </div>

              {/* Users table */}
              <div className="bg-black/20 border border-white/5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                        <th className="p-4">User Details</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Registered On</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                            No registered users found matching filter
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => {
                          const isSuspended = user.status === "suspended";
                          const isCurrentUserAdmin = user.email === "dahsorlahcohle@gmail.com" || user.role === "admin";
                          
                          return (
                            <tr key={user.uid} className="hover:bg-white/[0.01] transition-colors">
                              {/* Details */}
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-xs font-black text-white shrink-0">
                                    {user.displayName?.[0] || user.email?.[0] || "?"}
                                  </div>
                                  <div className="min-w-0 leading-tight">
                                    <span className="block font-bold text-white truncate max-w-[150px] sm:max-w-[200px]">
                                      {user.displayName || "User"}
                                    </span>
                                    <span className="block text-[10px] text-slate-500 truncate max-w-[150px] sm:max-w-[200px] mt-0.5">
                                      {user.email}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Role */}
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                                  user.role === "admin" 
                                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" 
                                    : "bg-white/5 text-slate-400"
                                }`}>
                                  {user.role || "user"}
                                </span>
                              </td>

                              {/* Status */}
                              <td className="p-4">
                                <span className={`flex items-center gap-1.5 font-medium ${
                                  isSuspended ? "text-rose-400" : "text-emerald-400"
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isSuspended ? "bg-rose-400" : "bg-emerald-400"}`} />
                                  {isSuspended ? "Suspended" : "Active"}
                                </span>
                              </td>

                              {/* Registration Date */}
                              <td className="p-4 font-mono text-[10px] text-slate-500">
                                {user.createdAt ? (
                                  new Date(user.createdAt.seconds * 1000).toLocaleDateString()
                                ) : (
                                  "Initial Setup"
                                )}
                              </td>

                              {/* Actions */}
                              <td className="p-4 text-right">
                                {isCurrentUserAdmin ? (
                                  <span className="text-[10px] text-slate-600 font-mono">Protected Admin</span>
                                ) : (
                                  <button
                                    onClick={() => handleToggleStatus(user.uid, user.status)}
                                    disabled={actionLoading === user.uid}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer ${
                                      isSuspended 
                                        ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" 
                                        : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                                    }`}
                                  >
                                    {actionLoading === user.uid ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : isSuspended ? (
                                      <>
                                        <UserCheck className="w-3.5 h-3.5" />
                                        Reactivate
                                      </>
                                    ) : (
                                      <>
                                        <UserX className="w-3.5 h-3.5" />
                                        Suspend
                                      </>
                                    )}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tab 2: Global Call Monitors */}
          {activeTab === "calls" && (
            <motion.div
              key="calls-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-black/20 border border-white/5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                        <th className="p-4">Caller Email</th>
                        <th className="p-4">Voice Persona</th>
                        <th className="p-4">Duration</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Placed On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {stats.recentCalls?.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                            No recent call sessions found on pipeline
                          </td>
                        </tr>
                      ) : (
                        stats.recentCalls?.map((call: any) => {
                          const isActive = call.status === "active";
                          return (
                            <tr key={call.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="p-4 font-mono text-[11px] text-slate-200">
                                {call.userEmail}
                              </td>
                              <td className="p-4">
                                <span className="bg-white/5 text-slate-300 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                                  {call.voiceId}
                                </span>
                              </td>
                              <td className="p-4 font-mono text-[11px]">
                                {isActive ? (
                                  <span className="text-amber-400 font-bold flex items-center gap-1">
                                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                                    Live
                                  </span>
                                ) : (
                                  formatDuration(call.durationSeconds)
                                )}
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  isActive 
                                    ? "bg-amber-400/10 text-amber-400 border border-amber-400/20 animate-pulse" 
                                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"
                                }`}>
                                  {call.status}
                                </span>
                              </td>
                              <td className="p-4 text-slate-500 text-[10px] font-mono">
                                {call.createdAt ? (
                                  new Date(call.createdAt).toLocaleString()
                                ) : (
                                  "Just now"
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tab 3: Admin Compliance Audit Logs */}
          {activeTab === "audit" && (
            <motion.div
              key="audit-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="space-y-3.5">
                {auditLogs.length === 0 ? (
                  <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center text-slate-500 italic text-xs">
                    No compliance changes logged yet
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 bg-black/30 border border-white/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded ${
                            log.action === "suspend_user" 
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}>
                            {log.action.replace("_", " ")}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200">
                          {log.details}
                        </p>
                        <div className="text-[10px] font-mono text-slate-500">
                          Target Account: <span className="text-indigo-300">{log.targetEmail}</span> ({log.targetUid})
                        </div>
                      </div>

                      <div className="md:text-right shrink-0">
                        <span className="block text-[10px] text-slate-500 font-mono">Audited Administrator</span>
                        <span className="block text-xs text-indigo-400 font-bold mt-0.5">
                          {log.adminEmail}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
