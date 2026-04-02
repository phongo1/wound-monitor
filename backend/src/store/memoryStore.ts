import { randomUUID } from "crypto";

import { createDefaultAlertSettings } from "../alerting/defaults";
import { AlertRecord, DeviceAlertSettings, StoredAlert } from "../types/alerting";
import { DeviceRecord } from "../types/device";
import { CreatePatientInput, PatientRecord } from "../types/patient";
import { Reading, StoredReading } from "../types/reading";
import { ReadingQueryOptions, ReadingsStore } from "./readingsStore";

class MemoryStore implements ReadingsStore {
  private readonly patients = new Map<string, PatientRecord>();
  private readonly devices = new Map<string, DeviceRecord>();
  private readings: StoredReading[] = [];
  private readonly alertSettings = new Map<string, DeviceAlertSettings>();
  private readonly alerts = new Map<string, StoredAlert>();

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

  async listPatients(): Promise<PatientRecord[]> {
    return [...this.patients.values()];
  }

  async createPatient(input: CreatePatientInput): Promise<PatientRecord> {
    const patientId = randomUUID();
    const deviceId = patientId;
    const patient: PatientRecord = {
      id: patientId,
      name: input.name,
      age: input.age,
      wound_type: input.wound_type,
      admission_date: input.admission_date,
      device_id: deviceId,
      baseline_temperature_c: null,
    };

    const device: DeviceRecord = {
      device_id: deviceId,
      patient_id: patientId,
      label: `${input.name} sensor`,
      baseline_temperature_c: null,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.patients.set(patientId, patient);
    this.devices.set(deviceId, device);

    return patient;
  }

  async getPatient(patientId: string): Promise<PatientRecord | null> {
    return this.patients.get(patientId) ?? null;
  }

  async getDeviceForPatient(patientId: string): Promise<DeviceRecord | null> {
    for (const device of this.devices.values()) {
      if (device.patient_id === patientId) {
        return device;
      }
    }

    return null;
  }

  async setBaselineForPatient(
    patientId: string,
    baselineTemperatureC: number,
  ): Promise<DeviceRecord> {
    const patient = this.patients.get(patientId);
    const device = await this.getDeviceForPatient(patientId);

    if (!patient || !device) {
      throw new Error("Patient device not found.");
    }

    const updatedDevice: DeviceRecord = {
      ...device,
      baseline_temperature_c: baselineTemperatureC,
      updated_at: new Date().toISOString(),
    };
    this.devices.set(updatedDevice.device_id, updatedDevice);

    const currentSettings =
      this.alertSettings.get(updatedDevice.device_id) ??
      createDefaultAlertSettings(updatedDevice.device_id);
    this.alertSettings.set(updatedDevice.device_id, {
      ...currentSettings,
      baseline_temperature_c: baselineTemperatureC,
    });

    this.patients.set(patientId, {
      ...patient,
      baseline_temperature_c: baselineTemperatureC,
    });

    return updatedDevice;
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
    const device = this.devices.get(deviceId);
    const settings = this.alertSettings.get(deviceId) ?? createDefaultAlertSettings(deviceId);

    return {
      ...settings,
      baseline_temperature_c: device?.baseline_temperature_c ?? settings.baseline_temperature_c,
    };
  }

  async latestAlertForDevice(deviceId: string): Promise<StoredAlert | null> {
    const alerts = [...this.alerts.values()]
      .filter((alert) => alert.device_id === deviceId)
      .sort((left, right) => right.created_at.localeCompare(left.created_at));

    return alerts[0] ?? null;
  }

  async createAlert(alert: AlertRecord): Promise<void> {
    if (this.alerts.has(alert.reading_id)) {
      return;
    }

    this.alerts.set(alert.reading_id, {
      ...alert,
      id: randomUUID(),
      created_at: new Date().toISOString(),
      resolved_at: null,
    });
  }
}

export const memoryStore = new MemoryStore();
