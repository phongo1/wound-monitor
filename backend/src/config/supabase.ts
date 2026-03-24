import { loadEnv } from "./loadEnv";

export type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
  table: string;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  loadEnv();

  const url = readEnv("SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const table = readEnv("SUPABASE_READINGS_TABLE") ?? "readings";

  if (!url && !serviceRoleKey) {
    return null;
  }

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase configuration is incomplete. Set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return { url, serviceRoleKey, table };
}
