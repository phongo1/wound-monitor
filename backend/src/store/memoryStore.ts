import { randomUUID } from "crypto";

import { createDefaultAlertSettings } from "../alerting/defaults";
import { AlertRecord, DeviceAlertSettings } from "../types/alerting";
import { Reading, StoredReading } from "../types/reading";
import { ReadingQueryOptions, ReadingsStore } from "./readingsStore";

class MemoryStore implements ReadingsStore {
  private readings: StoredReading[] = [];
  private readonly alertSettings = new Map<string, DeviceAlertSettings>();
  private readonly alerts = new Map<string, AlertRecord>();

  async add(reading: Reading): Promise<StoredReading> {
    const storedReading: StoredReading = {
      ...reading,
      id: randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.readings.push(storedReading);
    return storedReading;
  }

  async latest(): Promise<StoredReading | null> {
    if (this.readings.length === 0) {
      return null;
    }
    return this.readings[this.readings.length - 1];
  }

  async history(): Promise<StoredReading[]> {
    return this.readings;
  }

  async historyForDevice(
    deviceId: string,
    options?: ReadingQueryOptions,
  ): Promise<StoredReading[]> {
    const filteredReadings = this.readings
      .filter((reading) => reading.device_id === deviceId)
      .filter((reading) =>
        options?.sinceTimestamp === undefined
          ? true
          : reading.timestamp >= options.sinceTimestamp,
      )
      .filter((reading) =>
        options?.untilTimestamp === undefined
          ? true
          : reading.timestamp <= options.untilTimestamp,
      )
      .sort((left, right) => left.timestamp - right.timestamp);

    return options?.limit === undefined
      ? filteredReadings
      : filteredReadings.slice(-options.limit);
  }

  async getAlertSettings(deviceId: string): Promise<DeviceAlertSettings> {
    return this.alertSettings.get(deviceId) ?? createDefaultAlertSettings(deviceId);
  }

  async createAlert(alert: AlertRecord): Promise<void> {
    if (this.alerts.has(alert.reading_id)) {
      return;
    }

    this.alerts.set(alert.reading_id, alert);
  }
}

export const memoryStore = new MemoryStore();
