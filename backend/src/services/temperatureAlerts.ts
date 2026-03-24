import { ReadingsStore } from "../store/readingsStore";
import { AlertRecord, AlertSeverity, DeviceAlertSettings } from "../types/alerting";
import { StoredReading } from "../types/reading";

export type TemperatureHeuristicResult = {
  device_id: string;
  reading_count: number;
  window_minutes: number;
  latest_reading: StoredReading | null;
  earliest_reading: StoredReading | null;
  delta_c: number | null;
  elapsed_minutes: number | null;
  rate_c_per_hour: number | null;
  severity: AlertSeverity | null;
  thresholds: {
    min_readings: number;
    warning_delta_c: number;
    risk_delta_c: number;
    warning_rate_c_per_hour: number;
    risk_rate_c_per_hour: number;
  };
};

export async function evaluateReadingAndPersistAlert(
  store: ReadingsStore,
  reading: StoredReading,
): Promise<TemperatureHeuristicResult> {
  const settings = await store.getAlertSettings(reading.device_id);
  const windowMs = settings.window_minutes * 60 * 1000;
  const readings = await store.historyForDevice(reading.device_id, {
    sinceTimestamp: reading.timestamp - windowMs,
    untilTimestamp: reading.timestamp,
  });
  const result = evaluateTemperatureHeuristic(readings, settings);
  const alert = buildAlertRecord(result, reading.id);

  if (alert) {
    await store.createAlert(alert);
  }

  return result;
}

export function evaluateTemperatureHeuristic(
  readings: StoredReading[],
  settings: DeviceAlertSettings,
): TemperatureHeuristicResult {
  const orderedReadings = [...readings].sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp;
    }

    if (left.created_at !== right.created_at) {
      return left.created_at.localeCompare(right.created_at);
    }

    return left.id.localeCompare(right.id);
  });

  const earliestReading = orderedReadings[0] ?? null;
  const latestReading = orderedReadings[orderedReadings.length - 1] ?? null;

  let deltaC: number | null = null;
  let elapsedMinutes: number | null = null;
  let rateCPerHour: number | null = null;
  let severity: AlertSeverity | null = null;

  if (earliestReading && latestReading) {
    deltaC = latestReading.temperature_c - earliestReading.temperature_c;

    const elapsedMs = latestReading.timestamp - earliestReading.timestamp;
    if (elapsedMs > 0) {
      elapsedMinutes = elapsedMs / 60000;
      rateCPerHour = (deltaC * 3600000) / elapsedMs;
    }

    if (
      orderedReadings.length >= settings.min_readings &&
      deltaC !== null &&
      rateCPerHour !== null
    ) {
      if (
        deltaC >= settings.risk_delta_c &&
        rateCPerHour >= settings.risk_rate_c_per_hour
      ) {
        severity = "risk";
      } else if (
        deltaC >= settings.warning_delta_c &&
        rateCPerHour >= settings.warning_rate_c_per_hour
      ) {
        severity = "warning";
      }
    }
  }

  return {
    device_id: settings.device_id,
    reading_count: orderedReadings.length,
    window_minutes: settings.window_minutes,
    latest_reading: latestReading,
    earliest_reading: earliestReading,
    delta_c: deltaC,
    elapsed_minutes: elapsedMinutes,
    rate_c_per_hour: rateCPerHour,
    severity,
    thresholds: {
      min_readings: settings.min_readings,
      warning_delta_c: settings.warning_delta_c,
      risk_delta_c: settings.risk_delta_c,
      warning_rate_c_per_hour: settings.warning_rate_c_per_hour,
      risk_rate_c_per_hour: settings.risk_rate_c_per_hour,
    },
  };
}

function buildAlertRecord(
  result: TemperatureHeuristicResult,
  readingId: string,
): AlertRecord | null {
  if (!result.severity || result.delta_c === null || result.rate_c_per_hour === null) {
    return null;
  }

  const elapsedMinutes = result.elapsed_minutes?.toFixed(1) ?? "0.0";
  const message = `Temperature rose ${result.delta_c.toFixed(
    2,
  )} C over ${elapsedMinutes} minutes (${result.rate_c_per_hour.toFixed(
    2,
  )} C/hour).`;

  return {
    device_id: result.device_id,
    reading_id: readingId,
    severity: result.severity,
    kind: "temperature_change_over_time",
    message,
    status: "open",
    metadata: {
      reading_count: result.reading_count,
      window_minutes: result.window_minutes,
      delta_c: result.delta_c,
      elapsed_minutes: result.elapsed_minutes,
      rate_c_per_hour: result.rate_c_per_hour,
      thresholds: result.thresholds,
      earliest_reading_id: result.earliest_reading?.id ?? null,
      latest_reading_id: result.latest_reading?.id ?? null,
      latest_temperature_c: result.latest_reading?.temperature_c ?? null,
      latest_timestamp: result.latest_reading?.timestamp ?? null,
    },
  };
}
