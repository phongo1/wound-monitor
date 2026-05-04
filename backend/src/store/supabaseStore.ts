import { createDefaultAlertSettings } from "../alerting/defaults";
import { SupabaseConfig } from "../config/supabase";
import { AlertRecord, DeviceAlertSettings, StoredAlert } from "../types/alerting";
import { DeviceRecord } from "../types/device";
import { CreatePatientInput, PatientRecord } from "../types/patient";
import { Reading, StoredReading } from "../types/reading";
import { ReadingQueryOptions, ReadingsStore } from "./readingsStore";

const PLAUSIBLE_MIN_TEMPERATURE_C = 30;
const PLAUSIBLE_MAX_TEMPERATURE_C = 45;
const BASELINE_SAMPLE_SIZE = 400;

export class SupabaseStore implements ReadingsStore {
  constructor(private readonly config: SupabaseConfig) {}

  async add(reading: Reading): Promise<StoredReading> {
    const rows = await this.requestTable<StoredReading[]>(
      this.config.readingsTable,
      this.buildQuery({
        select: "id,device_id,temperature_c,timestamp,created_at",
      }),
      {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify([reading]),
      },
    );

    const storedReading = rows[0];
    if (!storedReading) {
      throw new Error("Supabase did not return the inserted reading.");
    }

    return storedReading;
  }

  async latest(): Promise<StoredReading | null> {
    const rows = await this.requestTable<StoredReading[]>(
      this.config.readingsTable,
      this.buildQuery({
        select: "id,device_id,temperature_c,timestamp,created_at",
        order: "timestamp.desc",
        limit: 1,
      }),
      {
        method: "GET",
      },
    );

    return rows[0] ?? null;
  }

  async history(): Promise<StoredReading[]> {
    return this.requestTable<StoredReading[]>(
      this.config.readingsTable,
      this.buildQuery({
        select: "id,device_id,temperature_c,timestamp,created_at",
        order: "timestamp.asc",
      }),
      {
        method: "GET",
      },
    );
  }

  async listPatients(): Promise<PatientRecord[]> {
    const patientRows = await this.requestTable<
      Array<{
        id: string;
        name: string;
        age: number;
        wound_type: string;
        admission_date: string;
      }>
    >(
      "patients",
      this.buildQuery({
        select: "id,name,age,wound_type,admission_date",
        order: "admission_date.desc",
      }),
      { method: "GET" },
    );

    const deviceRows = await this.requestTable<
      Array<{
        device_id: string;
        patient_id: string | null;
        baseline_temperature_c: number | null;
      }>
    >(
      this.config.devicesTable,
      this.buildQuery({
        select: "device_id,patient_id,baseline_temperature_c",
      }),
      { method: "GET" },
    );

    return patientRows.map((patient) => mapPatientRow(patient, deviceRows));
  }

  async createPatient(input: CreatePatientInput): Promise<PatientRecord> {
    const patientRows = await this.requestTable<
      Array<{
        id: string;
        name: string;
        age: number;
        wound_type: string;
        admission_date: string;
      }>
    >(
      "patients",
      this.buildQuery({
        select: "id,name,age,wound_type,admission_date",
      }),
      {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify([
          {
            name: input.name,
            age: input.age,
            wound_type: input.wound_type,
            admission_date: input.admission_date,
          },
        ]),
      },
    );

    const patient = patientRows[0];
    if (!patient) {
      throw new Error("Supabase did not return the inserted patient.");
    }

    const deviceId = patient.id;
    await this.requestTable(
      this.config.devicesTable,
      this.buildQuery({}),
      {
        method: "POST",
        headers: {
          Prefer: "return=minimal",
        },
        body: JSON.stringify([
          {
            device_id: deviceId,
            patient_id: patient.id,
            label: `${patient.name} sensor`,
            status: "active",
          },
        ]),
      },
    );

    return {
      id: patient.id,
      name: patient.name,
      age: patient.age,
      wound_type: patient.wound_type,
      admission_date: patient.admission_date,
      device_id: deviceId,
      baseline_temperature_c: null,
    };
  }

  async getPatient(patientId: string): Promise<PatientRecord | null> {
    const patientRows = await this.requestTable<
      Array<{
        id: string;
        name: string;
        age: number;
        wound_type: string;
        admission_date: string;
      }>
    >(
      "patients",
      this.buildQuery({
        select: "id,name,age,wound_type,admission_date",
        id: `eq.${patientId}`,
        limit: 1,
      }),
      { method: "GET" },
    );

    const patient = patientRows[0];
    if (!patient) {
      return null;
    }

    const device = await this.getDeviceForPatient(patientId);
    return {
      id: patient.id,
      name: patient.name,
      age: patient.age,
      wound_type: patient.wound_type,
      admission_date: patient.admission_date,
      device_id: device?.device_id ?? null,
      baseline_temperature_c: device?.baseline_temperature_c ?? null,
    };
  }

  async getDeviceForPatient(patientId: string): Promise<DeviceRecord | null> {
    const deviceRows = await this.requestTable<DeviceRecord[]>(
      this.config.devicesTable,
      this.buildQuery({
        select: "device_id,patient_id,label,baseline_temperature_c,status,created_at,updated_at",
        patient_id: `eq.${patientId}`,
        limit: 1,
      }),
      { method: "GET" },
    );

    return deviceRows[0] ?? null;
  }

  async ensureBaselineForDevice(
    deviceId: string,
    baselineTemperatureC: number,
  ): Promise<DeviceRecord | null> {
    void baselineTemperatureC;
    const deviceRows = await this.requestTable<DeviceRecord[]>(
      this.config.devicesTable,
      this.buildQuery({
        select: "device_id,patient_id,label,baseline_temperature_c,status,created_at,updated_at",
        device_id: `eq.${deviceId}`,
        limit: 1,
      }),
      { method: "GET" },
    );

    const device = deviceRows[0];
    if (!device) {
      return null;
    }

    if (device.baseline_temperature_c !== null) {
      return device;
    }

    const baselineCandidates = (await this.historyForDevice(deviceId))
      .filter(
        (reading) =>
          reading.temperature_c >= PLAUSIBLE_MIN_TEMPERATURE_C &&
          reading.temperature_c <= PLAUSIBLE_MAX_TEMPERATURE_C,
      )
      .slice(0, BASELINE_SAMPLE_SIZE);

    if (baselineCandidates.length < BASELINE_SAMPLE_SIZE) {
      return device;
    }

    const computedBaselineTemperatureC = computeTrimmedMeanTemperature(
      baselineCandidates,
    );

    const updatedRows = await this.requestTable<DeviceRecord[]>(
      this.config.devicesTable,
      this.buildQuery({
        select: "device_id,patient_id,label,baseline_temperature_c,status,created_at,updated_at",
        device_id: `eq.${deviceId}`,
      }),
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          baseline_temperature_c: computedBaselineTemperatureC,
        }),
      },
    );

    return updatedRows[0] ?? null;
  }

  async assignDeviceToPatient(patientId: string, deviceId: string): Promise<DeviceRecord> {
    const patient = await this.getPatient(patientId);
    if (!patient) {
      throw new Error("Patient not found.");
    }

    const currentDevice = await this.getDeviceForPatient(patientId);
    if (currentDevice?.device_id === deviceId) {
      return currentDevice;
    }

    if (currentDevice) {
      await this.requestTable(
        this.config.devicesTable,
        this.buildQuery({
          device_id: `eq.${currentDevice.device_id}`,
        }),
        {
          method: "PATCH",
          headers: {
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            patient_id: null,
          }),
        },
      );
    }

    const existingRows = await this.requestTable<DeviceRecord[]>(
      this.config.devicesTable,
      this.buildQuery({
        select: "device_id,patient_id,label,baseline_temperature_c,status,created_at,updated_at",
        device_id: `eq.${deviceId}`,
        limit: 1,
      }),
      { method: "GET" },
    );

    const existingDevice = existingRows[0];
    if (existingDevice) {
      const updatedRows = await this.requestTable<DeviceRecord[]>(
        this.config.devicesTable,
        this.buildQuery({
          select: "device_id,patient_id,label,baseline_temperature_c,status,created_at,updated_at",
          device_id: `eq.${deviceId}`,
        }),
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            patient_id: patientId,
            baseline_temperature_c:
              existingDevice.baseline_temperature_c ?? currentDevice?.baseline_temperature_c ?? null,
            status: "active",
          }),
        },
      );

      const updatedDevice = updatedRows[0];
      if (!updatedDevice) {
        throw new Error("Failed to assign existing device.");
      }

      return updatedDevice;
    }

    const createdRows = await this.requestTable<DeviceRecord[]>(
      this.config.devicesTable,
      this.buildQuery({
        select: "device_id,patient_id,label,baseline_temperature_c,status,created_at,updated_at",
      }),
      {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify([
          {
            device_id: deviceId,
            patient_id: patientId,
            label: currentDevice?.label ?? `${patient.name} sensor`,
            baseline_temperature_c: currentDevice?.baseline_temperature_c ?? null,
            status: "active",
          },
        ]),
      },
    );

    const createdDevice = createdRows[0];
    if (!createdDevice) {
      throw new Error("Failed to create assigned device.");
    }

    return createdDevice;
  }

  async resetMonitoringForPatient(patientId: string): Promise<DeviceRecord> {
    const device = await this.getDeviceForPatient(patientId);
    if (!device) {
      throw new Error("Patient device not found.");
    }

    await this.requestTable(
      this.config.alertsTable,
      this.buildQuery({
        device_id: `eq.${device.device_id}`,
      }),
      {
        method: "DELETE",
        headers: {
          Prefer: "return=minimal",
        },
      },
    );

    await this.requestTable(
      this.config.readingsTable,
      this.buildQuery({
        device_id: `eq.${device.device_id}`,
      }),
      {
        method: "DELETE",
        headers: {
          Prefer: "return=minimal",
        },
      },
    );

    const deviceRows = await this.requestTable<DeviceRecord[]>(
      this.config.devicesTable,
      this.buildQuery({
        select: "device_id,patient_id,label,baseline_temperature_c,status,created_at,updated_at",
        device_id: `eq.${device.device_id}`,
      }),
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          baseline_temperature_c: null,
        }),
      },
    );

    const updatedDevice = deviceRows[0];
    if (!updatedDevice) {
      throw new Error("Failed to reset monitoring state.");
    }

    return updatedDevice;
  }

  async setBaselineForPatient(
    patientId: string,
    baselineTemperatureC: number,
  ): Promise<DeviceRecord> {
    const device = await this.getDeviceForPatient(patientId);
    if (!device) {
      throw new Error("Patient device not found.");
    }

    const deviceRows = await this.requestTable<DeviceRecord[]>(
      this.config.devicesTable,
      this.buildQuery({
        select: "device_id,patient_id,label,baseline_temperature_c,status,created_at,updated_at",
        device_id: `eq.${device.device_id}`,
      }),
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          baseline_temperature_c: baselineTemperatureC,
        }),
      },
    );

    const updatedDevice = deviceRows[0];
    if (!updatedDevice) {
      throw new Error("Failed to update device baseline.");
    }

    return updatedDevice;
  }

  async historyForDevice(
    deviceId: string,
    options?: ReadingQueryOptions,
  ): Promise<StoredReading[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("select", "id,device_id,temperature_c,timestamp,created_at");
    searchParams.set("device_id", `eq.${deviceId}`);
    searchParams.set("order", "timestamp.asc");

    if (
      options?.sinceTimestamp !== undefined &&
      options?.untilTimestamp !== undefined
    ) {
      searchParams.set(
        "and",
        `(timestamp.gte.${options.sinceTimestamp},timestamp.lte.${options.untilTimestamp})`,
      );
    } else if (options?.sinceTimestamp !== undefined) {
      searchParams.set("timestamp", `gte.${options.sinceTimestamp}`);
    } else if (options?.untilTimestamp !== undefined) {
      searchParams.set("timestamp", `lte.${options.untilTimestamp}`);
    }

    if (options?.limit !== undefined) {
      searchParams.set("limit", String(options.limit));
    }

    return this.requestTable<StoredReading[]>(
      this.config.readingsTable,
      this.searchParamsToQuery(searchParams),
      {
        method: "GET",
      },
    );
  }

  async getAlertSettings(deviceId: string): Promise<DeviceAlertSettings> {
    const deviceRows = await this.requestTable<
      Array<{ device_id: string; baseline_temperature_c: number | null }>
    >(
      this.config.devicesTable,
      this.buildQuery({
        select: "device_id,baseline_temperature_c",
        device_id: `eq.${deviceId}`,
        limit: 1,
      }),
      {
        method: "GET",
      },
    );

    const settingsRows = await this.requestTable<
      Array<{
        device_id: string;
        window_minutes: number;
        min_rebound_readings: number;
        cold_spot_delta_c: number;
        inflammation_delta_c: number;
        rebound_rate_c_per_hour: number;
      }>
    >(
      this.config.alertSettingsTable,
      this.buildQuery({
        select:
          "device_id,window_minutes,min_rebound_readings,cold_spot_delta_c,inflammation_delta_c,rebound_rate_c_per_hour",
        device_id: `eq.${deviceId}`,
        limit: 1,
      }),
      {
        method: "GET",
      },
    );

    const defaultSettings = createDefaultAlertSettings(deviceId);
    const device = deviceRows[0];
    const settings = settingsRows[0];

    return {
      ...defaultSettings,
      baseline_temperature_c: device?.baseline_temperature_c ?? null,
      ...(settings ?? {}),
    };
  }

  async latestAlertForDevice(deviceId: string): Promise<StoredAlert | null> {
    const rows = await this.requestTable<StoredAlert[]>(
      this.config.alertsTable,
      this.buildQuery({
        select:
          "id,device_id,reading_id,severity,kind,message,status,metadata,created_at,resolved_at",
        device_id: `eq.${deviceId}`,
        order: "created_at.desc",
        limit: 1,
      }),
      { method: "GET" },
    );

    return rows[0] ?? null;
  }

  async createAlert(alert: AlertRecord): Promise<void> {
    await this.requestTable(
      this.config.alertsTable,
      this.buildQuery({
        on_conflict: "reading_id",
      }),
      {
        method: "POST",
        headers: {
          Prefer: "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify([alert]),
      },
    );
  }

  private async requestTable<T>(
    table: string,
    query: string,
    init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> },
  ): Promise<T> {
    const response = await fetch(`${this.tableEndpoint(table)}${query}`, {
      ...init,
      headers: {
        apikey: this.config.serviceRoleKey,
        Authorization: `Bearer ${this.config.serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Supabase request failed (${response.status} ${response.statusText}): ${errorText}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const responseText = await response.text();
    if (!responseText) {
      return undefined as T;
    }

    return JSON.parse(responseText) as T;
  }

  private buildQuery(params: Record<string, string | number>): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      searchParams.set(key, String(value));
    }

    return this.searchParamsToQuery(searchParams);
  }

  private searchParamsToQuery(searchParams: URLSearchParams): string {
    const query = searchParams.toString();
    return query ? `?${query}` : "";
  }

  private tableEndpoint(table: string): string {
    const baseUrl = this.config.url.replace(/\/+$/, "");
    return `${baseUrl}/rest/v1/${encodeURIComponent(table)}`;
  }
}

function mapPatientRow(
  patient: {
    id: string;
    name: string;
    age: number;
    wound_type: string;
    admission_date: string;
  },
  devices: Array<{
    device_id: string;
    patient_id: string | null;
    baseline_temperature_c: number | null;
  }>,
): PatientRecord {
  const device = devices.find((candidate) => candidate.patient_id === patient.id);

  return {
    id: patient.id,
    name: patient.name,
    age: patient.age,
    wound_type: patient.wound_type,
    admission_date: patient.admission_date,
    device_id: device?.device_id ?? null,
    baseline_temperature_c: device?.baseline_temperature_c ?? null,
  };
}

function computeTrimmedMeanTemperature(readings: StoredReading[]): number {
  const temperatures = readings
    .map((reading) => reading.temperature_c)
    .sort((left, right) => left - right);
  const trimCount = Math.floor(temperatures.length * 0.1);
  const trimmedTemperatures = temperatures.slice(
    trimCount,
    temperatures.length - trimCount,
  );
  return (
    trimmedTemperatures.reduce((sum, temperature) => sum + temperature, 0) /
    trimmedTemperatures.length
  );
}
