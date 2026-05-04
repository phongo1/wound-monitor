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
    typeof candidate.timestamp === "number"
  );
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

export default router;
