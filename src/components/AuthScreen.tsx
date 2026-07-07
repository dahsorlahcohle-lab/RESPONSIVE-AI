import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getSupabase } from "../lib/supabase";
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  Sparkles, 
  Phone, 
  ArrowRight, 
  RefreshCw, 
  Eye, 
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ExternalLink
} from "lucide-react";

interface AuthScreenProps {
  onSuccess: (token: string, user: any) => void;
}

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  
  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isOperationNotAllowed, setIsOperationNotAllowed] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsOperationNotAllowed(false);
    setLoading(true);

    try {
      const supabase = getSupabase();

      if (mode === "login") {
        if (!email || !password) {
          throw new Error("Please enter both email and password.");
        }

        // 1. Authenticate primarily using Supabase Auth
        const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (sbError) {
          // Map to user-friendly messages for Supabase Auth errors
          if (sbError.message.includes("Invalid login credentials") || sbError.message.includes("invalid_credentials")) {
            throw new Error("Incorrect email or password. Please try again.");
          }
          throw sbError;
        }

        if (sbData.session) {
          onSuccess(sbData.session.access_token, {
            uid: sbData.user.id,
            email: sbData.user.email,
            displayName: sbData.user.user_metadata?.displayName || sbData.user.user_metadata?.full_name || email.split("@")[0]
          });
        } else {
          throw new Error("No active session established. Please log in again.");
        }

      } else if (mode === "register") {
        if (!email || !password || !displayName || !confirmPassword) {
          throw new Error("Please fill out all fields.");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        
        // 1. Create a new user account in Supabase Authentication (Primary)
        const { data: sbData, error: sbError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              displayName,
              full_name: displayName
            }
          }
        });

        if (sbError) {
          if (sbError.message.includes("User already registered") || sbError.message.includes("Email already in use")) {
            throw new Error("This email is already registered.");
          }
          throw sbError;
        }

        if (sbData.session) {
          onSuccess(sbData.session.access_token, {
            uid: sbData.user?.id || "temp-uid",
            email: sbData.user?.email || email,
            displayName: displayName
          });
        } else {
          setSuccessMsg("Registration successful! Check your inbox to verify your email, or try logging in.");
          setMode("login");
        }

      } else if (mode === "forgot") {
        if (!email) {
          throw new Error("Please enter your email address.");
        }
        
        // Use Supabase Auth for password reset email primarily
        const { error: sbError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (sbError) {
          throw sbError;
        }

        setSuccessMsg("Password reset email sent! Check your inbox.");
        setMode("login");
      }
    } catch (err: any) {
      console.error("Auth action failed:", err);
      let friendlyMessage = err.message;
      if (err.message?.includes("invalid_credentials") || err.message?.includes("Invalid login credentials")) {
        friendlyMessage = "Incorrect email or password. Please try again.";
      } else if (err.message?.includes("already registered") || err.message?.includes("Email already in use")) {
        friendlyMessage = "This email is already registered.";
      } else if (err.message?.includes("weak-password") || err.message?.includes("should be at least")) {
        friendlyMessage = "Password is too weak. Please use at least 6 characters.";
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl relative"
      >
        {/* Floating App Branding */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
            <Phone className="w-7 h-7 text-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span className="flex items-center">
              RESPONSIVE AI
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, "", "/admin");
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }}
                className="text-slate-600 hover:text-slate-500 select-none transition-colors duration-200 cursor-pointer text-[10px] ml-1 focus:outline-none"
                aria-label="Branding Accent"
              >
                •
              </button>
            </span>
            <span className="bg-indigo-500/10 text-indigo-300 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border border-indigo-500/20 font-bold">
              Live
            </span>
          </h2>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            Real-time vocal conversation with cinematic AI voices
          </p>
        </div>

        {/* Status Messages */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-rose-300 text-xs"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2 text-emerald-300 text-xs"
            >
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleAuth} className="space-y-4">
          {mode === "register" && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block ml-1">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <UserIcon className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Your Full Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-all font-sans"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block ml-1">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-all font-sans"
              />
            </div>
          </div>

          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Password
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-[10px] text-indigo-400 font-semibold hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-11 pr-11 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === "register" && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block ml-1">
                Confirm Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-11 pr-11 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-all font-sans"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-500 hover:to-violet-400 shadow-lg shadow-indigo-500/10 active:scale-95 transition-all text-sm font-sans mt-4 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>
                  {mode === "login"
                    ? "Log In with Supabase"
                    : mode === "register"
                    ? "Create Supabase Account"
                    : "Send Reset Instructions"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Toggle Mode Links */}
        <div className="mt-6 pt-6 border-t border-white/5 text-center">
          {mode === "login" ? (
            <p className="text-xs text-slate-500">
              New to RESPONSIVE AI?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-indigo-400 font-bold hover:underline cursor-pointer"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-indigo-400 font-bold hover:underline cursor-pointer"
              >
                Log In
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
