import React, { useState } from "react";
import { User, Plus, Search, Trash2, Building, Phone, Calendar, Sparkles } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  company: string;
  phone: string;
  notes: string;
  created_at?: string;
}

interface ContactManagerProps {
  contacts: Contact[];
  selectedContactId: string | null;
  onSelectContact: (contactId: string | null) => void;
  onCreateContact: (name: string, company: string, phone: string, notes: string) => Promise<void>;
  onDeleteContact?: (id: string) => Promise<void>;
}

export default function ContactManager({
  contacts,
  selectedContactId,
  onSelectContact,
  onCreateContact,
  onDeleteContact
}: ContactManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await onCreateContact(newName, newCompany, newPhone, newNotes);
      setNewName("");
      setNewCompany("");
      setNewPhone("");
      setNewNotes("");
      setIsAdding(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-5 backdrop-blur-md flex flex-col h-full min-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-400" />
            Client & Contact Directory
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Link calls to saved client records</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`p-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold ${
            isAdding 
              ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
              : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
          }`}
        >
          <Plus className={`w-3.5 h-3.5 transition-transform ${isAdding ? "rotate-45" : ""}`} />
          <span>{isAdding ? "Cancel" : "Add Contact"}</span>
        </button>
      </div>

      {/* Add Contact Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full bg-slate-950/80 border border-white/10 rounded-lg py-1.5 px-3 text-xs text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1">Company</label>
              <input
                type="text"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="Acme Corp"
                className="w-full bg-slate-950/80 border border-white/10 rounded-lg py-1.5 px-3 text-xs text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1">Phone Number</label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+1 555-0199"
                className="w-full bg-slate-950/80 border border-white/10 rounded-lg py-1.5 px-3 text-xs text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1">Notes</label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Key call parameters..."
                className="w-full bg-slate-950/80 border border-white/10 rounded-lg py-1.5 px-3 text-xs text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 text-white font-bold py-2 rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? "Creating..." : "Save Contact Record"}
          </button>
        </form>
      )}

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search name, company, or number..."
          className="w-full bg-slate-950/50 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-white/10 transition-all"
        />
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto space-y-2 max-h-[250px] scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-600 text-[11px] font-mono italic">
            No contacts found in directory.
          </div>
        ) : (
          filtered.map((contact) => {
            const isSelected = selectedContactId === contact.id;
            return (
              <div
                key={contact.id}
                onClick={() => onSelectContact(isSelected ? null : contact.id)}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex items-start justify-between gap-2 group ${
                  isSelected
                    ? "bg-indigo-600/10 border-indigo-500/40"
                    : "bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/30"
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-100 block truncate">
                      {contact.name}
                    </span>
                    {isSelected && (
                      <span className="bg-indigo-500/20 text-indigo-300 text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-indigo-500/30 uppercase tracking-wider scale-95 shrink-0">
                        Selected
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] font-mono text-slate-500">
                    {contact.company && (
                      <span className="flex items-center gap-1">
                        <Building className="w-3 h-3 text-slate-600" />
                        {contact.company}
                      </span>
                    )}
                    {contact.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-600" />
                        {contact.phone}
                      </span>
                    )}
                  </div>

                  {contact.notes && (
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 italic">
                      "{contact.notes}"
                    </p>
                  )}
                </div>

                {onDeleteContact && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`Are you sure you want to delete ${contact.name}?`)) {
                        await onDeleteContact(contact.id);
                        if (isSelected) onSelectContact(null);
                      }
                    }}
                    className="p-1 text-slate-600 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                    title="Delete Contact"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Select anonymous state indicator */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
        <span className="font-mono">Active Selector:</span>
        <span className="font-bold font-mono">
          {selectedContactId
            ? contacts.find((c) => c.id === selectedContactId)?.name
            : "Anonymous / Default Caller"}
        </span>
      </div>
    </div>
  );
}
