import { DeviceAlertSettings } from "../types/alerting";

export const DEFAULT_ALERT_WINDOW_MINUTES = 120;
export const DEFAULT_MIN_REBOUND_READINGS = 2;
export const DEFAULT_COLD_SPOT_DELTA_C = 0.5;
export const DEFAULT_INFLAMMATION_DELTA_C = 0.5;
export const DEFAULT_REBOUND_RATE_C_PER_HOUR = 0.6;

export function createDefaultAlertSettings(deviceId: string): DeviceAlertSettings {
  return {
    device_id: deviceId,
    baseline_temperature_c: null,
    window_minutes: DEFAULT_ALERT_WINDOW_MINUTES,
    min_rebound_readings: DEFAULT_MIN_REBOUND_READINGS,
    cold_spot_delta_c: DEFAULT_COLD_SPOT_DELTA_C,
    inflammation_delta_c: DEFAULT_INFLAMMATION_DELTA_C,
    rebound_rate_c_per_hour: DEFAULT_REBOUND_RATE_C_PER_HOUR,
  };
}
