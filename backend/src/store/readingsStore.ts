import { AlertRecord, DeviceAlertSettings } from "../types/alerting";
import { Reading, StoredReading } from "../types/reading";

export type ReadingQueryOptions = {
  sinceTimestamp?: number;
  untilTimestamp?: number;
  limit?: number;
};

export interface ReadingsStore {
  add(reading: Reading): Promise<StoredReading>;
  latest(): Promise<StoredReading | null>;
  history(): Promise<StoredReading[]>;
  historyForDevice(
    deviceId: string,
    options?: ReadingQueryOptions,
  ): Promise<StoredReading[]>;
  getAlertSettings(deviceId: string): Promise<DeviceAlertSettings>;
  createAlert(alert: AlertRecord): Promise<void>;
}
