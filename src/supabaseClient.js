import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY, supabaseEstConfigure } from "./configSupabase.js";

export const supabase = supabaseEstConfigure()
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;
