#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = "10.0.0.228";
const PORT = 3000;
const PATH = "/api/readings";
const TRIALS = 5;
const SAMPLES_PER_TRIAL = 100;
const DELAY_BETWEEN_REQUESTS_MS = 100;

const outFile = path.join(__dirname, "alert_latency_trials.csv");

fs.writeFileSync(outFile, "trial,sample,alert_latency_ms\n");

function doPost(payload) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: PATH,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on("error", (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async function runTrials() {
  console.log(`Running ${TRIALS} trials × ${SAMPLES_PER_TRIAL} samples...`);

  for (let t = 1; t <= TRIALS; t++) {
    const trialSamples = [];
    console.log(`Starting trial ${t}...`);

    for (let s = 1; s <= SAMPLES_PER_TRIAL; s++) {
      const now = Date.now();
      const payload = JSON.stringify({
        device_id: "test-alert-latency-script",
        temperature_c: 37.5 + (Math.random() - 0.5) * 2,
        timestamp: now,
      });

      try {
        const res = await doPost(payload);
        try {
          const json = res.body ? JSON.parse(res.body) : {};
          if (json && json.latency && json.latency.alert_latency_ms != null) {
            const alertLatency = Number(json.latency.alert_latency_ms);
            trialSamples.push(alertLatency);
            console.log(
              `Trial ${t} Sample ${s} | alert_latency_ms: ${alertLatency} ms`,
            );
          } else {
            console.warn(
              `Trial ${t} Sample ${s} | missing latency.alert_latency_ms or non-2xx status (${res.statusCode})`,
            );
          }
        } catch (err) {
          console.error(
            `Trial ${t} Sample ${s} | failed to parse response: ${err.message}`,
          );
        }
      } catch (err) {
        console.error(`Trial ${t} Sample ${s} | request error: ${err.message}`);
      }

      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }

    if (trialSamples.length === 0) {
      console.error(`Trial ${t} collected 0 samples; writing empty rows.`);
      for (let s = 1; s <= SAMPLES_PER_TRIAL; s++) {
        fs.appendFileSync(outFile, `${t},${s},\n`);
      }
      continue;
    }

    const min = Math.min(...trialSamples);
    const max = Math.max(...trialSamples);
    const sum = trialSamples.reduce((a, b) => a + b, 0);
    const avg = sum / trialSamples.length;
    const variance =
      trialSamples.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) /
      trialSamples.length;
    const stdDev = Math.sqrt(variance);

    for (let i = 0; i < SAMPLES_PER_TRIAL; i++) {
      const val = trialSamples[i] != null ? trialSamples[i] : "";
      fs.appendFileSync(outFile, `${t},${i + 1},${val}\n`);
    }

    console.log(
      `Trial ${t} summary → Avg: ${avg.toFixed(2)} ms | Min: ${min} ms | Max: ${max} ms | StdDev: ${stdDev.toFixed(2)} ms`,
    );
  }

  console.log(`\nAll trials complete. CSV written to: ${outFile}`);
})();
