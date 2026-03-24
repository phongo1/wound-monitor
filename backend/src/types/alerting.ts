export type AlertSeverity = "warning" | "risk";
export type AlertStatus = "open" | "resolved" | "dismissed";

export type DeviceAlertSettings = {
  device_id: string;
  window_minutes: number;
  min_readings: number;
  warning_delta_c: number;
  risk_delta_c: number;
  warning_rate_c_per_hour: number;
  risk_rate_c_per_hour: number;
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
