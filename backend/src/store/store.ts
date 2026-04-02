import { getSupabaseConfig } from "../config/supabase";
import { memoryStore } from "./memoryStore";
import { ReadingsStore } from "./readingsStore";
import { SupabaseStore } from "./supabaseStore";

const supabaseConfig = getSupabaseConfig();

export const store: ReadingsStore = supabaseConfig
  ? new SupabaseStore(supabaseConfig)
  : memoryStore;
