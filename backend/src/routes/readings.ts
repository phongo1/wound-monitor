import { Router } from "express";

import { memoryStore } from "../store/memoryStore";
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

router.post("/readings", (req, res) => {
  if (!isReadingPayload(req.body)) {
    return res.status(400).json({ error: "Invalid reading payload" });
  }

  memoryStore.add(req.body);
  return res.status(201).json({ ok: true });
});

router.get("/latest", (_req, res) => {
  const latest = memoryStore.latest();
  if (!latest) {
    return res.status(404).json({ error: "No readings yet" });
  }
  return res.json(latest);
});

router.get("/history", (_req, res) => {
  return res.json(memoryStore.history());
});

export default router;
