import { ReadingsStore } from "../store/readingsStore";
import { AlertRecord, AlertSeverity, DeviceAlertSettings } from "../types/alerting";
import { StoredReading } from "../types/reading";

const PLAUSIBLE_MIN_TEMPERATURE_C = 30;
const PLAUSIBLE_MAX_TEMPERATURE_C = 45;
const MOVING_AVERAGE_WINDOW = 5;

type SmoothedReading = {
  source: StoredReading;
  temperature_c: number;
};

export type TemperatureHeuristicResult = {
  device_id: string;
  baseline_temperature_c: number | null;
  reading_count: number;
  window_minutes: number;
  latest_reading: StoredReading | null;
  cold_spot_reading: StoredReading | null;
  latest_below_baseline_c: number | null;
  latest_above_baseline_c: number | null;
  cold_spot_depth_c: number | null;
  rebound_delta_c: number | null;
  rebound_elapsed_minutes: number | null;
  rebound_rate_c_per_hour: number | null;
  rebound_reading_count: number;
  severity: AlertSeverity | null;
  thresholds: {
    min_rebound_readings: number;
    cold_spot_delta_c: number;
    inflammation_delta_c: number;
    rebound_rate_c_per_hour: number;
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
  const plausibleReadings = orderedReadings.filter(
    (reading) =>
      reading.temperature_c >= PLAUSIBLE_MIN_TEMPERATURE_C &&
      reading.temperature_c <= PLAUSIBLE_MAX_TEMPERATURE_C,
  );
  const smoothedReadings = buildMovingAverageReadings(plausibleReadings, MOVING_AVERAGE_WINDOW);

  const latestReading = plausibleReadings[plausibleReadings.length - 1] ?? null;
  const latestSmoothedReading = smoothedReadings[smoothedReadings.length - 1] ?? null;
  const baselineTemperatureC = settings.baseline_temperature_c;
  const coldSpotReading = getSustainedColdSpotReading(smoothedReadings, settings);
  const recentSmoothed = smoothedReadings.slice(-10);
  const recentPlausibleReadings = plausibleReadings.slice(-10);

  let latestBelowBaselineC: number | null = null;
  let latestAboveBaselineC: number | null = null;
  let coldSpotDepthC: number | null = null;
  let reboundDeltaC: number | null = null;
  let reboundElapsedMinutes: number | null = null;
  let reboundRateCPerHour: number | null = null;
  let reboundReadingCount = 0;
  let severity: AlertSeverity | null = null;

  if (baselineTemperatureC !== null && latestReading && latestSmoothedReading) {
    latestBelowBaselineC = Math.max(
      0,
      baselineTemperatureC - latestSmoothedReading.temperature_c,
    );
    latestAboveBaselineC = Math.max(
      0,
      latestSmoothedReading.temperature_c - baselineTemperatureC,
    );

    if (coldSpotReading) {
      coldSpotDepthC = baselineTemperatureC - coldSpotReading.temperature_c;
    }

    const hasSustainedColdSpot = coldSpotReading !== null;
    if (hasSustainedColdSpot) {
      severity = "warning";
    }

    if (recentSmoothed.length >= 10) {
      const smoothedAbove05Count = recentSmoothed.filter(
        (reading) => reading.temperature_c - baselineTemperatureC > 0.5,
      ).length;
      const smoothedRecentTrend =
        recentSmoothed[recentSmoothed.length - 1]!.temperature_c - recentSmoothed[0]!.temperature_c;
      const isInflammationWarning =
        smoothedAbove05Count >= 8 && smoothedRecentTrend > 0;

      if (isInflammationWarning) {
        severity = "warning";
      }
    }

    if (recentPlausibleReadings.length >= 10) {
      const readingsAbove10Count = recentPlausibleReadings.filter(
        (reading) => reading.temperature_c - baselineTemperatureC > 1.0,
      ).length;
      const overallRiseC =
        recentPlausibleReadings[recentPlausibleReadings.length - 1]!.temperature_c -
        recentPlausibleReadings[0]!.temperature_c;
      const isInflammationRisk = readingsAbove10Count >= 8 && overallRiseC >= 1.0;

      reboundDeltaC = overallRiseC;
      const reboundElapsedMs =
        recentPlausibleReadings[recentPlausibleReadings.length - 1]!.timestamp -
        recentPlausibleReadings[0]!.timestamp;
      reboundReadingCount = recentPlausibleReadings.length;
      if (reboundElapsedMs > 0) {
        reboundElapsedMinutes = reboundElapsedMs / 60000;
        reboundRateCPerHour = (overallRiseC * 3600000) / reboundElapsedMs;
      }

      if (isInflammationRisk) {
        severity = "risk";
      }
    }
  }

  return {
    device_id: settings.device_id,
    baseline_temperature_c: baselineTemperatureC,
    reading_count: orderedReadings.length,
    window_minutes: settings.window_minutes,
    latest_reading: latestReading,
    cold_spot_reading: coldSpotReading,
    latest_below_baseline_c: latestBelowBaselineC,
    latest_above_baseline_c: latestAboveBaselineC,
    cold_spot_depth_c: coldSpotDepthC,
    rebound_delta_c: reboundDeltaC,
    rebound_elapsed_minutes: reboundElapsedMinutes,
    rebound_rate_c_per_hour: reboundRateCPerHour,
    rebound_reading_count: reboundReadingCount,
    severity,
    thresholds: {
      min_rebound_readings: settings.min_rebound_readings,
      cold_spot_delta_c: settings.cold_spot_delta_c,
      inflammation_delta_c: settings.inflammation_delta_c,
      rebound_rate_c_per_hour: settings.rebound_rate_c_per_hour,
    },
  };
}

function buildAlertRecord(
  result: TemperatureHeuristicResult,
  readingId: string,
): AlertRecord | null {
  if (!result.severity || result.baseline_temperature_c === null) {
    return null;
  }

  if (result.severity === "warning") {
    if (result.latest_below_baseline_c === null) {
      return null;
    }

    const isInflammationWarning = result.cold_spot_reading === null;
    return {
      device_id: result.device_id,
      reading_id: readingId,
      severity: "warning",
      kind: isInflammationWarning ? "inflammation_warning" : "cold_spot",
      message: isInflammationWarning
        ? `Inflammation warning detected: sustained temperatures are above baseline ${result.baseline_temperature_c.toFixed(
            2,
          )} C with a positive trend.`
        : `Cold spot detected: wound temperature is ${result.latest_below_baseline_c.toFixed(
            2,
          )} C below baseline ${result.baseline_temperature_c.toFixed(2)} C.`,
      status: "open",
      metadata: {
        baseline_temperature_c: result.baseline_temperature_c,
        reading_count: result.reading_count,
        window_minutes: result.window_minutes,
        cold_spot_depth_c: result.cold_spot_depth_c,
        latest_below_baseline_c: result.latest_below_baseline_c,
        thresholds: result.thresholds,
        cold_spot_reading_id: result.cold_spot_reading?.id ?? null,
        latest_reading_id: result.latest_reading?.id ?? null,
        latest_temperature_c: result.latest_reading?.temperature_c ?? null,
        latest_timestamp: result.latest_reading?.timestamp ?? null,
      },
    };
  }

  return {
    device_id: result.device_id,
    reading_id: readingId,
    severity: "risk",
    kind: "inflammation_risk",
    message: `Inflammation risk detected: sustained elevated readings exceed +1.0 C over baseline with an overall rise of ${(
      result.rebound_delta_c ?? 0
    ).toFixed(2)} C.`,
    status: "open",
    metadata: {
      baseline_temperature_c: result.baseline_temperature_c,
      reading_count: result.reading_count,
      window_minutes: result.window_minutes,
      cold_spot_depth_c: result.cold_spot_depth_c,
      latest_above_baseline_c: result.latest_above_baseline_c,
      rebound_delta_c: result.rebound_delta_c,
      rebound_elapsed_minutes: result.rebound_elapsed_minutes,
      rebound_rate_c_per_hour: result.rebound_rate_c_per_hour,
      rebound_reading_count: result.rebound_reading_count,
      thresholds: result.thresholds,
      cold_spot_reading_id: result.cold_spot_reading?.id ?? null,
      latest_reading_id: result.latest_reading?.id ?? null,
      latest_temperature_c: result.latest_reading?.temperature_c ?? null,
      latest_timestamp: result.latest_reading?.timestamp ?? null,
    },
  };
}

function getColdSpotCandidates(
  readings: SmoothedReading[],
  settings: DeviceAlertSettings,
): SmoothedReading[] {
  if (settings.baseline_temperature_c === null) {
    return [];
  }

  return readings.filter(
    (reading) =>
      settings.baseline_temperature_c !== null &&
      settings.baseline_temperature_c - reading.temperature_c >= settings.cold_spot_delta_c,
  );
}

function getColdestReading(readings: StoredReading[]): StoredReading | null {
  return readings.reduce<StoredReading | null>((coldest, reading) => {
    if (!coldest || reading.temperature_c < coldest.temperature_c) {
      return reading;
    }

    return coldest;
  }, null);
}

function buildMovingAverageReadings(
  readings: StoredReading[],
  windowSize: number,
): SmoothedReading[] {
  const smoothed: SmoothedReading[] = [];
  for (let index = windowSize - 1; index < readings.length; index += 1) {
    const window = readings.slice(index - (windowSize - 1), index + 1);
    const averageTemperatureC =
      window.reduce((sum, reading) => sum + reading.temperature_c, 0) / window.length;
    smoothed.push({
      source: readings[index]!,
      temperature_c: averageTemperatureC,
    });
  }
  return smoothed;
}

function getSustainedColdSpotReading(
  smoothedReadings: SmoothedReading[],
  settings: DeviceAlertSettings,
): StoredReading | null {
  const coldSpotIndexes = getColdSpotCandidates(smoothedReadings, settings).map((candidate) =>
    smoothedReadings.findIndex((smoothed) => smoothed.source.id === candidate.source.id),
  );
  if (coldSpotIndexes.length < 2) {
    return null;
  }

  const sustainedCandidates = coldSpotIndexes
    .filter((index) => {
      const hasPreviousNeighbor = coldSpotIndexes.includes(index - 1);
      const hasNextNeighbor = coldSpotIndexes.includes(index + 1);
      return hasPreviousNeighbor || hasNextNeighbor;
    })
    .map((index) => smoothedReadings[index]!)
    .filter(Boolean);

  if (sustainedCandidates.length === 0) {
    return null;
  }

  const coldest = sustainedCandidates.reduce<SmoothedReading | null>(
    (currentColdest, candidate) => {
      if (!currentColdest || candidate.temperature_c < currentColdest.temperature_c) {
        return candidate;
      }
      return currentColdest;
    },
    null,
  );
  return coldest?.source ?? null;
}
