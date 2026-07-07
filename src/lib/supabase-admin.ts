import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    // Force dotenv to load before reading process.env
    dotenv.config();

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase server-side admin credentials are missing. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return adminClient;
}
