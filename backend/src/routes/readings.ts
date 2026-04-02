import { Router } from "express";

import { evaluateReadingAndPersistAlert } from "../services/temperatureAlerts";
import { store } from "../store/store";
import { Reading } from "../types/reading";

const router = Router();

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
  if (!isReadingPayload(req.body)) {
    return res.status(400).json({ error: "Invalid reading payload" });
  }

  try {
    const storedReading = await store.add(req.body);

    try {
      const heuristic = await evaluateReadingAndPersistAlert(store, storedReading);
      return res.status(201).json({
        ok: true,
        reading: storedReading,
        heuristic,
      });
    } catch (error) {
      return res.status(201).json({
        ok: true,
        reading: storedReading,
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
