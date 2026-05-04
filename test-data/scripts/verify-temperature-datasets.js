const fs = require("fs");
const path = require("path");

const {
  evaluateTemperatureHeuristicTimeline,
} = require("../../backend/dist/services/temperatureAlerts");

const DATASETS_DIR = path.resolve(__dirname, "..");

const settings = {
  device_id: "demo",
  baseline_temperature_c: 36.5,
  window_minutes: 120,
  min_rebound_readings: 2,
  cold_spot_delta_c: 1.5,
  inflammation_delta_c: 0.5,
  rebound_rate_c_per_hour: 0.6,
};

const PLAUSIBLE_MIN = 30;
const PLAUSIBLE_MAX = 45;
const BASELINE_SIZE = 400;

const expectations = {
  normal: "none",
  transient_cold_spot: "none",
  cold_spot: "warning_only",
  mild_sustained_elevation: "warning_only",
  strong_sustained_elevation: "risk",
};

function getDirs(externalOnly) {
  if (externalOnly) return [path.join(DATASETS_DIR, "external")];
  return [
    path.join(DATASETS_DIR, "representative"),
    path.join(DATASETS_DIR, "trials"),
    path.join(DATASETS_DIR, "robustness"),
  ];
}

function listCsvFiles(dirs) {
  const files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { recursive: true });
    for (const f of entries) {
      if (f.endsWith(".csv")) {
        files.push(path.join(dir, f));
      }
    }
  }
  return files.sort();
}

function readRows(filePath) {
  const lines = fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1);
  return lines.map((line, i) => {
    const [ts, temp] = line.split(",");
    return {
      id: String(i),
      device_id: "demo",
      temperature_c: Number(temp),
      timestamp: Number(ts),
    };
  });
}

function getBaseline(rows) {
  const valid = rows.filter(
    (r) => r.temperature_c >= PLAUSIBLE_MIN && r.temperature_c <= PLAUSIBLE_MAX,
  );
  if (valid.length < BASELINE_SIZE) return null;
  return computeTrimmedMeanTemperature(valid.slice(0, BASELINE_SIZE));
}

function computeTrimmedMeanTemperature(rows) {
  const temperatures = rows
    .map((row) => row.temperature_c)
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

function verifyFile(filePath) {
  const rows = readRows(filePath);
  const baseline = getBaseline(rows);
  if (!baseline) return { passed: false, pattern: "invalid" };

  const result = evaluateTemperatureHeuristicTimeline(rows, {
    ...settings,
    baseline_temperature_c: baseline,
  });
  const hasWarning = result.has_warning;
  const hasRisk = result.has_risk;

  const pattern = path.basename(filePath, ".csv").replace(/_\d+$/, "");
  const expected = expectations[pattern] ?? "unmapped";

  const passed =
    expected === "unmapped"
      ? true
      : expected === "none"
      ? !hasWarning && !hasRisk
      : expected === "warning_only"
        ? hasWarning && !hasRisk
        : expected === "risk"
          ? hasRisk
          : false;

  return { pattern, passed, expected };
}

const externalOnly = process.argv.includes("--external");
const dirs = getDirs(externalOnly);
const files = listCsvFiles(dirs);

if (files.length === 0) {
  console.log("No CSV files found.");
  process.exit(0);
}

const summary = new Map();

for (const file of files) {
  const result = verifyFile(file);
  const pattern = result.pattern;

  if (!summary.has(pattern)) summary.set(pattern, { total: 0, passed: 0 });
  const s = summary.get(pattern);
  s.total += 1;
  if (result.passed) s.passed += 1;

  console.log(
    `${path.relative(DATASETS_DIR, file)}: ${
      result.expected === "unmapped"
        ? "UNMAPPED"
        : result.passed
          ? "PASS"
          : "FAIL"
    }`,
  );
}

console.log("\n=== Per-Pattern Summary ===");
for (const [pattern, stats] of [...summary.entries()].sort()) {
  const expected = expectations[pattern] ?? "unmapped";
  console.log(
    `${pattern.padEnd(25)}: ${stats.passed}/${stats.total} passed (expected: ${expected})`,
  );
}

const totalPassed = Array.from(summary.values()).reduce(
  (a, s) => a + s.passed,
  0,
);
console.log(`\nOverall: ${totalPassed}/${files.length} passed`);
