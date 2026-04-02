import { Router } from "express";

import {
  evaluateReadingAndPersistAlert,
  evaluateTemperatureHeuristic,
} from "../services/temperatureAlerts";
import { store } from "../store/store";
import { CreatePatientInput } from "../types/patient";
import { Reading } from "../types/reading";

const router = Router();

function isCreatePatientPayload(body: unknown): body is CreatePatientInput {
  if (!body || typeof body !== "object") {
    return false;
  }

  const candidate = body as Partial<CreatePatientInput>;

  return (
    typeof candidate.name === "string" &&
    typeof candidate.age === "number" &&
    typeof candidate.wound_type === "string" &&
    typeof candidate.admission_date === "string"
  );
}

function isBaselinePayload(body: unknown): body is { temperature_c: number; timestamp?: number } {
  if (!body || typeof body !== "object") {
    return false;
  }

  const candidate = body as Partial<{ temperature_c: number; timestamp?: number }>;
  return (
    typeof candidate.temperature_c === "number" &&
    (candidate.timestamp === undefined || typeof candidate.timestamp === "number")
  );
}

function isPatientReadingPayload(
  body: unknown,
): body is { temperature_c: number; timestamp?: number } {
  return isBaselinePayload(body);
}

function isDeviceAssignmentPayload(body: unknown): body is { device_id: string } {
  if (!body || typeof body !== "object") {
    return false;
  }

  const candidate = body as Partial<{ device_id: string }>;
  return typeof candidate.device_id === "string" && candidate.device_id.trim().length > 0;
}

function normalizeTimestamp(timestamp: number): number {
  return timestamp < 100000000000 ? Date.now() : timestamp;
}

router.get("/patients", async (_req, res) => {
  try {
    return res.json(await store.listPatients());
  } catch (error) {
    return res.status(500).json({
      error: "Failed to load patients",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/patients", async (req, res) => {
  if (!isCreatePatientPayload(req.body)) {
    return res.status(400).json({ error: "Invalid patient payload" });
  }

  try {
    const patient = await store.createPatient(req.body);
    return res.status(201).json(patient);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to create patient",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/patients/:id/monitoring", async (req, res) => {
  try {
    const patient = await store.getPatient(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const device = await store.getDeviceForPatient(patient.id);
    const readings = patient.device_id
      ? await store.historyForDevice(patient.device_id)
      : [];
    const latestAlert = patient.device_id
      ? await store.latestAlertForDevice(patient.device_id)
      : null;
    const latestReading = readings[readings.length - 1] ?? null;
    const settings = patient.device_id
      ? await store.getAlertSettings(patient.device_id)
      : null;
    const heuristic =
      latestReading && settings
        ? evaluateTemperatureHeuristic(
            readings.filter(
              (reading) =>
                reading.timestamp >=
                latestReading.timestamp - settings.window_minutes * 60 * 1000,
            ),
            settings,
          )
        : null;

    return res.json({
      patient,
      device,
      readings,
      latest_alert: latestAlert,
      heuristic,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to load monitoring data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/patients/:id/baseline", async (req, res) => {
  if (!isBaselinePayload(req.body)) {
    return res.status(400).json({ error: "Invalid baseline payload" });
  }

  try {
    const patient = await store.getPatient(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const device = await store.setBaselineForPatient(patient.id, req.body.temperature_c);
    const timestamp = normalizeTimestamp(req.body.timestamp ?? Date.now());
    const reading: Reading = {
      device_id: device.device_id,
      temperature_c: req.body.temperature_c,
      timestamp,
    };
    const storedReading = await store.add(reading);
    const heuristic = await evaluateReadingAndPersistAlert(store, storedReading);

    return res.status(201).json({
      device,
      reading: storedReading,
      heuristic,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to set baseline",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/patients/:id/readings", async (req, res) => {
  if (!isPatientReadingPayload(req.body)) {
    return res.status(400).json({ error: "Invalid reading payload" });
  }

  try {
    const patient = await store.getPatient(req.params.id);
    if (!patient || !patient.device_id) {
      return res.status(404).json({ error: "Patient device not found" });
    }

    const reading: Reading = {
      device_id: patient.device_id,
      temperature_c: req.body.temperature_c,
      timestamp: normalizeTimestamp(req.body.timestamp ?? Date.now()),
    };

    await store.ensureBaselineForDevice(patient.device_id, req.body.temperature_c);
    const storedReading = await store.add(reading);
    const heuristic = await evaluateReadingAndPersistAlert(store, storedReading);

    return res.status(201).json({
      reading: storedReading,
      heuristic,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to create reading",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/patients/:id/device", async (req, res) => {
  if (!isDeviceAssignmentPayload(req.body)) {
    return res.status(400).json({ error: "Invalid device assignment payload" });
  }

  try {
    const patient = await store.getPatient(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const device = await store.assignDeviceToPatient(patient.id, req.body.device_id.trim());
    return res.status(200).json({ device });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to assign device",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/patients/:id/reset", async (req, res) => {
  try {
    const patient = await store.getPatient(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const device = await store.resetMonitoringForPatient(patient.id);
    return res.status(200).json({ device });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to reset monitoring data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
