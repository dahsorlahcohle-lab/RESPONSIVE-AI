import { createClient, SupabaseClient } from "@supabase/supabase-js";

let clientInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!clientInstance) {
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
    const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase client-side credentials are missing. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    }

    clientInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return clientInstance;
}
