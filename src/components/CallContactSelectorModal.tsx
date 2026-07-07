import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Search, Plus, User, Building, Phone, ArrowRight, UserPlus } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  company: string;
  phone: string;
  notes: string;
}

interface CallContactSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  onSelectAndStartCall: (contactId: string | null) => void;
  onCreateContact: (name: string, company: string, phone: string, notes: string) => Promise<void>;
}

export default function CallContactSelectorModal({
  isOpen,
  onClose,
  contacts,
  onSelectAndStartCall,
  onCreateContact
}: CallContactSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const filtered = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreateContact(name, company, phone, notes);
      setIsCreating(false);
      setName("");
      setCompany("");
      setPhone("");
      setNotes("");
      // Refreshing contacts and picking the newly created one will be done by the parent, but we can also start immediately
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="contact_picker_overlay" className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <motion.div
        id="contact_picker_panel"
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="p-5 border-b border-white/5 bg-slate-950/40 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              Place a Voice Call
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Select a contact to link and begin streaming</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {isCreating ? (
            /* Creating Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Create New Contact Profile</span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-[10px] text-indigo-400 font-bold hover:underline"
                >
                  Cancel / List Contacts
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1">Company</label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Acme Corp"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1">Phone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 555-0199"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1">Introductory Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Key topics for this contact..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? "Creating Profile..." : "Create Profile"}
              </button>
            </form>
          ) : (
            /* Contacts list & quick call option */
            <div className="space-y-4">
              {/* Quick Call */}
              <button
                onClick={() => onSelectAndStartCall(null)}
                className="w-full p-3.5 bg-gradient-to-r from-emerald-600/10 to-teal-500/10 hover:from-emerald-600/25 hover:to-teal-500/25 border border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl flex items-center justify-between transition-all text-left cursor-pointer group"
              >
                <div>
                  <span className="font-extrabold text-xs text-white block">Quick Call (Anonymous)</span>
                  <span className="text-[10px] text-emerald-400 font-medium">Bypass profile linkage and call immediately</span>
                </div>
                <ArrowRight className="w-4.5 h-4.5 text-emerald-400 group-hover:translate-x-1 transition-transform shrink-0" />
              </button>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Saved Contacts List</span>
                <button
                  onClick={() => setIsCreating(true)}
                  className="text-[10px] text-indigo-400 font-bold hover:underline flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Contact</span>
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full bg-slate-950/50 border border-white/5 rounded-xl py-1.5 pl-9 pr-4 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-white/10 transition-all"
                />
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin">
                {filtered.length === 0 ? (
                  <div className="text-center py-6 text-slate-600 text-xs italic bg-white/[0.01] rounded-xl border border-white/[0.02]">
                    No contacts found matching search query.
                  </div>
                ) : (
                  filtered.map(c => {
                    const initials = c.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                    return (
                      <button
                        key={c.id}
                        onClick={() => onSelectAndStartCall(c.id)}
                        className="w-full p-3 bg-black/20 hover:bg-indigo-600/10 border border-white/5 hover:border-indigo-500/25 rounded-xl flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px] group-hover:bg-indigo-500 group-hover:text-white transition-all shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-white block truncate">{c.name}</span>
                            <span className="text-[9px] text-slate-500 block truncate font-mono">
                              {c.company ? `${c.company} • ` : ""}{c.phone || "No phone"}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
