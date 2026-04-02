export type Patient = {
  id: string;
  name: string;
  age: number;
  woundType: string;
  admissionDate: string;
  deviceId: string | null;
  baselineTemperatureC: number | null;
};

export type CreatePatientInput = {
  name: string;
  age: number;
  woundType: string;
  admissionDate: string;
};

export type MonitoringReading = {
  id: string;
  timestamp: number;
  recordedAtMs: number;
  temperature: number;
  createdAt: string;
};

export type MonitoringAlert = {
  id: string;
  severity: "warning" | "risk";
  kind: string;
  message: string;
  createdAt: string;
};

export type MonitoringHeuristic = {
  severity: "warning" | "risk" | null;
  latestAboveBaselineC: number | null;
  latestBelowBaselineC: number | null;
  reboundRateCPerHour: number | null;
};

export type MonitoringSnapshot = {
  patient: Patient;
  readings: MonitoringReading[];
  latestAlert: MonitoringAlert | null;
  heuristic: MonitoringHeuristic | null;
};

const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000/api"
).replace(/\/+$/, "");

export async function listPatients(): Promise<Patient[]> {
  const response = await fetch(`${apiBaseUrl}/patients`);
  return parseJsonResponse(response).then((payload) =>
    (payload as ApiPatient[]).map(mapPatient),
  );
}

export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  const response = await fetch(`${apiBaseUrl}/patients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      age: input.age,
      wound_type: input.woundType,
      admission_date: input.admissionDate,
    }),
  });

  return mapPatient(await parseJsonResponse<ApiPatient>(response));
}

export async function getPatientMonitoring(patientId: string): Promise<MonitoringSnapshot> {
  const response = await fetch(`${apiBaseUrl}/patients/${patientId}/monitoring`);
  const payload = await parseJsonResponse<ApiMonitoringSnapshot>(response);

  return {
    patient: mapPatient(payload.patient),
    readings: payload.readings.map(mapReading),
    latestAlert: payload.latest_alert ? mapAlert(payload.latest_alert) : null,
    heuristic: payload.heuristic
      ? {
          severity: payload.heuristic.severity,
          latestAboveBaselineC: payload.heuristic.latest_above_baseline_c,
          latestBelowBaselineC: payload.heuristic.latest_below_baseline_c,
          reboundRateCPerHour: payload.heuristic.rebound_rate_c_per_hour,
        }
      : null,
  };
}

export async function setPatientBaseline(
  patientId: string,
  temperatureC: number,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/patients/${patientId}/baseline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      temperature_c: temperatureC,
      timestamp: Date.now(),
    }),
  });

  await parseJsonResponse(response);
}

export async function addPatientReading(
  patientId: string,
  temperatureC: number,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/patients/${patientId}/readings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      temperature_c: temperatureC,
      timestamp: Date.now(),
    }),
  });

  await parseJsonResponse(response);
}

export async function assignPatientDevice(
  patientId: string,
  deviceId: string,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/patients/${patientId}/device`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_id: deviceId,
    }),
  });

  await parseJsonResponse(response);
}

export async function resetPatientMonitoring(patientId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/patients/${patientId}/reset`, {
    method: "POST",
  });

  await parseJsonResponse(response);
}

type ApiPatient = {
  id: string;
  name: string;
  age: number;
  wound_type: string;
  admission_date: string;
  device_id: string | null;
  baseline_temperature_c: number | null;
};

type ApiReading = {
  id: string;
  timestamp: number;
  temperature_c: number;
  created_at: string;
};

type ApiAlert = {
  id: string;
  severity: "warning" | "risk";
  kind: string;
  message: string;
  created_at: string;
};

type ApiMonitoringSnapshot = {
  patient: ApiPatient;
  readings: ApiReading[];
  latest_alert: ApiAlert | null;
  heuristic: {
    severity: "warning" | "risk" | null;
    latest_above_baseline_c: number | null;
    latest_below_baseline_c: number | null;
    rebound_rate_c_per_hour: number | null;
  } | null;
};

function mapPatient(patient: ApiPatient): Patient {
  return {
    id: patient.id,
    name: patient.name,
    age: patient.age,
    woundType: patient.wound_type,
    admissionDate: patient.admission_date,
    deviceId: patient.device_id,
    baselineTemperatureC: patient.baseline_temperature_c,
  };
}

function mapReading(reading: ApiReading): MonitoringReading {
  return {
    id: reading.id,
    timestamp: reading.timestamp,
    recordedAtMs: Date.parse(reading.created_at),
    temperature: reading.temperature_c,
    createdAt: reading.created_at,
  };
}

function mapAlert(alert: ApiAlert): MonitoringAlert {
  return {
    id: alert.id,
    severity: alert.severity,
    kind: alert.kind,
    message: alert.message,
    createdAt: alert.created_at,
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & {
    error?: string;
    details?: string;
  };

  if (!response.ok) {
    throw new Error(payload.details || payload.error || "Request failed");
  }

  return payload;
}
