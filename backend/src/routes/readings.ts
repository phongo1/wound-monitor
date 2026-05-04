import { Router } from "express";

import { evaluateReadingAndPersistAlert } from "../services/temperatureAlerts";
import { store } from "../store/store";
import { Reading } from "../types/reading";

const router = Router();

function normalizeTimestamp(timestamp: number): number {
  return timestamp < 100000000000 ? Date.now() : timestamp;
}

function isReadingPayload(body: unknown): body is Reading {
  if (!body || typeof body !== "object") {
    return false;
  }

  const candidate = body as Partial<Reading>;

  return (
    typeof candidate.device_id === "string" &&
    typeof candidate.temperature_c === "number" &&
    typeof candidate.timestamp === "number" &&
    (candidate.sequence_number === undefined ||
      candidate.sequence_number === null ||
      typeof candidate.sequence_number === "number")
  );
}

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildReliabilityReport(readings: Reading[]) {
  const sequencedReadings = readings
    .filter(
      (reading): reading is Reading & { sequence_number: number } =>
        typeof reading.sequence_number === "number" &&
        Number.isInteger(reading.sequence_number) &&
        reading.sequence_number > 0,
    )
    .sort((left, right) => left.sequence_number - right.sequence_number);

  const receivedCount = sequencedReadings.length;
  const uniqueSequences = new Set(
    sequencedReadings.map((reading) => reading.sequence_number),
  );
  const duplicateCount = receivedCount - uniqueSequences.size;
  const firstSequenceNumber = sequencedReadings[0]?.sequence_number ?? null;
  const lastSequenceNumber =
    sequencedReadings[sequencedReadings.length - 1]?.sequence_number ?? null;
  const expectedCount =
    firstSequenceNumber === null || lastSequenceNumber === null
      ? 0
      : lastSequenceNumber - firstSequenceNumber + 1;
  const missingCount =
    expectedCount === 0 ? 0 : expectedCount - uniqueSequences.size;

  return {
    received_count: receivedCount,
    unique_count: uniqueSequences.size,
    expected_count: expectedCount,
    missing_count: missingCount,
    duplicate_count: duplicateCount,
    dropout_rate: expectedCount === 0 ? 0 : missingCount / expectedCount,
    first_sequence_number: firstSequenceNumber,
    last_sequence_number: lastSequenceNumber,
  };
}

router.post("/readings", async (req, res) => {
  const backendReceivedAt = Date.now();

  if (!isReadingPayload(req.body)) {
    return res.status(400).json({ error: "Invalid reading payload" });
  }

  try {
    const reading = {
      ...req.body,
      timestamp: normalizeTimestamp(req.body.timestamp),
    };
    const storedReading = await store.add(reading);
    await store.ensureBaselineForDevice(
      storedReading.device_id,
      storedReading.temperature_c,
    );

    try {
      const heuristic = await evaluateReadingAndPersistAlert(
        store,
        storedReading,
      );
      const alertDoneAt = Date.now();
      return res.status(201).json({
        ok: true,
        reading: storedReading,
        heuristic,
        latency: {
          alert_latency_ms: alertDoneAt - backendReceivedAt,
          e2e_ms: alertDoneAt - reading.timestamp,
        },
      });
    } catch (error) {
      const alertDoneAt = Date.now();
      return res.status(201).json({
        ok: true,
        reading: storedReading,
        latency: {
          alert_latency_ms: alertDoneAt - backendReceivedAt,
          e2e_ms: alertDoneAt - reading.timestamp,
        },
        alerting: {
          ok: false,
          details: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: "Failed to store reading",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/latest", async (_req, res) => {
  try {
    const latest = await store.latest();
    if (!latest) {
      return res.status(404).json({ error: "No readings yet" });
    }
    return res.json(latest);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to load latest reading",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/history", async (_req, res) => {
  try {
    return res.json(await store.history());
  } catch (error) {
    return res.status(500).json({
      error: "Failed to load reading history",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/reliability", async (req, res) => {
  const deviceId =
    typeof req.query.device_id === "string" ? req.query.device_id.trim() : "";
  const requestedLimit = parsePositiveInteger(req.query.last);
  const limit = Math.min(requestedLimit ?? 1000, 10000);

  if (!deviceId) {
    return res.status(400).json({ error: "device_id is required" });
  }

  try {
    const readings = await store.historyForDevice(deviceId, { limit });
    return res.json({
      device_id: deviceId,
      requested_last: limit,
      ...buildReliabilityReport(readings),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to build reliability report",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
