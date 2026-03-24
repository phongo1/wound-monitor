import { DeviceAlertSettings } from "../types/alerting";

export const DEFAULT_ALERT_WINDOW_MINUTES = 120;
export const DEFAULT_MIN_READINGS = 3;
export const DEFAULT_WARNING_DELTA_C = 1.0;
export const DEFAULT_RISK_DELTA_C = 2.0;
export const DEFAULT_WARNING_RATE_C_PER_HOUR = 0.3;
export const DEFAULT_RISK_RATE_C_PER_HOUR = 0.6;

export function createDefaultAlertSettings(deviceId: string): DeviceAlertSettings {
  return {
    device_id: deviceId,
    window_minutes: DEFAULT_ALERT_WINDOW_MINUTES,
    min_readings: DEFAULT_MIN_READINGS,
    warning_delta_c: DEFAULT_WARNING_DELTA_C,
    risk_delta_c: DEFAULT_RISK_DELTA_C,
    warning_rate_c_per_hour: DEFAULT_WARNING_RATE_C_PER_HOUR,
    risk_rate_c_per_hour: DEFAULT_RISK_RATE_C_PER_HOUR,
  };
}
