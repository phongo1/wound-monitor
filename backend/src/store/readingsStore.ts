import { AlertRecord, DeviceAlertSettings, StoredAlert } from "../types/alerting";
import { DeviceRecord } from "../types/device";
import { CreatePatientInput, PatientRecord } from "../types/patient";
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
  listPatients(): Promise<PatientRecord[]>;
  createPatient(input: CreatePatientInput): Promise<PatientRecord>;
  getPatient(patientId: string): Promise<PatientRecord | null>;
  getDeviceForPatient(patientId: string): Promise<DeviceRecord | null>;
  setBaselineForPatient(patientId: string, baselineTemperatureC: number): Promise<DeviceRecord>;
  historyForDevice(
    deviceId: string,
    options?: ReadingQueryOptions,
  ): Promise<StoredReading[]>;
  getAlertSettings(deviceId: string): Promise<DeviceAlertSettings>;
  latestAlertForDevice(deviceId: string): Promise<StoredAlert | null>;
  createAlert(alert: AlertRecord): Promise<void>;
}
