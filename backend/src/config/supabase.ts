import { loadEnv } from "./loadEnv";

export type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
  devicesTable: string;
  readingsTable: string;
  alertsTable: string;
  alertSettingsTable: string;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  loadEnv();

  const url = readEnv("SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const devicesTable = readEnv("SUPABASE_DEVICES_TABLE") ?? "devices";
  const readingsTable = readEnv("SUPABASE_READINGS_TABLE") ?? "readings";
  const alertsTable = readEnv("SUPABASE_ALERTS_TABLE") ?? "alerts";
  const alertSettingsTable =
    readEnv("SUPABASE_ALERT_SETTINGS_TABLE") ?? "device_alert_settings";

  if (!url && !serviceRoleKey) {
    return null;
  }

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase configuration is incomplete. Set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return {
    url,
    serviceRoleKey,
    devicesTable,
    readingsTable,
    alertsTable,
    alertSettingsTable,
  };
}
