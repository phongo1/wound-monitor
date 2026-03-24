export type AlertSeverity = "warning" | "risk";
export type AlertStatus = "open" | "resolved" | "dismissed";

export type DeviceAlertSettings = {
  device_id: string;
  baseline_temperature_c: number | null;
  window_minutes: number;
  min_rebound_readings: number;
  cold_spot_delta_c: number;
  inflammation_delta_c: number;
  rebound_rate_c_per_hour: number;
};

export type AlertRecord = {
  device_id: string;
  reading_id: string;
  severity: AlertSeverity;
  kind: string;
  message: string;
  status?: AlertStatus;
  metadata: Record<string, unknown>;
};
