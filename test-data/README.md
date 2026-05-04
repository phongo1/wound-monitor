# Test Data

## Synthetic Temperature Dataset

This directory contains synthetic temperature CSV files for validating the backend temperature heuristic.

The `external/` dataset is organized into generated pattern categories, with 50 trials per category and 28,800 sequential readings per file.

**Categories:**

- Normal (stable baseline)
- Transient Cold Spot (non-sustained cooling)
- Cold Spot (sustained localized cooling)
- Mild Sustained Elevation (sustained mild temperature elevation)
- Strong Sustained Elevation (strong sustained temperature elevation)

Each CSV has columns: `timestamp,temperature_c`.

Expected outcomes are defined in `scripts/verify-temperature-datasets.js`.

Run verification with:

```bash
node test-data/scripts/verify-temperature-datasets.js --external
```

## Files

- `external/` - synthetic temperature CSV files
- `scripts/` - heuristic verification script
- `e2e_latency.csv` - 500 end-to-end latency measurements (5 trials x 100 samples)
- `alert_latency_trials.csv` - 500 backend latency measurements (5 trials x 100 samples)
