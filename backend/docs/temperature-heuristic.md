# Temperature Heuristic

This backend uses a two-stage wound temperature heuristic:

1. A **cold spot** is treated as a `warning`.
2. A **cold spot followed by a rapid rebound above baseline** is treated as `risk`.

## Why

The model assumes this sequence is clinically meaningful:

- The wound site first gets colder than expected relative to its baseline.
- That can indicate reduced blood flow to the wound site.
- If the temperature then rebounds quickly and rises above baseline, that can indicate inflammation.
- That rebound pattern is treated as a stronger infection signal than a simple isolated rise.

## Inputs

The heuristic depends on:

- `devices.baseline_temperature_c`
- Recent readings for the same `device_id`
- `device_alert_settings` for that device

Relevant settings:

- `window_minutes`
- `min_rebound_readings`
- `cold_spot_delta_c`
- `inflammation_delta_c`
- `rebound_rate_c_per_hour`

If a device has no `device_alert_settings` row, the backend uses defaults from [defaults.ts](/Users/phongle/dev/smart-bandage/backend/src/alerting/defaults.ts).

If a device has no `baseline_temperature_c`, the heuristic returns no alert.

## Warning Rule

A reading is a `warning` when the **latest** reading is below baseline by at least `cold_spot_delta_c`.

Formula:

```text
baseline_temperature_c - latest_temperature_c >= cold_spot_delta_c
```

Example:

- baseline = `34.2 C`
- latest = `33.5 C`
- drop = `0.7 C`
- if `cold_spot_delta_c = 0.5`, this becomes a `warning`

## Risk Rule

A reading is `risk` when all of these are true:

- there was an earlier cold spot inside the active time window
- the latest reading is now above baseline by at least `inflammation_delta_c`
- the rebound from the cold spot to the latest reading is fast enough
- there are at least `min_rebound_readings` from the cold spot onward

Formulas:

```text
baseline_temperature_c - cold_spot_temperature_c >= cold_spot_delta_c
latest_temperature_c - baseline_temperature_c >= inflammation_delta_c
rebound_rate_c_per_hour =
  (latest_temperature_c - cold_spot_temperature_c) / hours_since_cold_spot
rebound_rate_c_per_hour >= rebound_rate_c_per_hour_threshold
```

Example:

- baseline = `34.2 C`
- cold spot = `33.4 C`
- latest = `34.9 C`
- cold spot depth = `0.8 C` below baseline
- rebound above baseline = `0.7 C`
- rebound delta = `1.5 C`
- if that rebound happened over `90 minutes`, the rate is `1.0 C/hour`

With thresholds:

- `cold_spot_delta_c = 0.5`
- `inflammation_delta_c = 0.5`
- `rebound_rate_c_per_hour = 0.6`

that sequence becomes `risk`.

## Windowing

The backend only evaluates readings in the trailing `window_minutes` window ending at the reading that was just inserted.

That means:

- old cold spots outside the window do not count
- alerting is tied to recent temperature behavior
- inserting an older backfilled reading evaluates only the window ending at that reading's timestamp

## Reading Selection

Within the active window:

- the backend finds the **latest** reading
- it finds the **coldest** reading that qualifies as a cold spot
- for risk, it only uses cold spots that happened **before** the latest reading

This prevents a below-baseline latest reading from being treated as both the cold spot and the rebound target.

## Alert Types

The backend writes these alert kinds:

- `cold_spot`
- `cold_spot_rebound_above_baseline`

Severity mapping:

- `cold_spot` => `warning`
- `cold_spot_rebound_above_baseline` => `risk`

## Current Defaults

Current defaults from [defaults.ts](/smart-bandage/backend/src/alerting/defaults.ts):

- `window_minutes = 120`
- `min_rebound_readings = 2`
- `cold_spot_delta_c = 0.5`
- `inflammation_delta_c = 0.5`
- `rebound_rate_c_per_hour = 0.6`

These are product defaults, not clinical validation.

## Implementation Reference

Main logic lives in:

- [temperatureAlerts.ts](/smart-bandage/backend/src/services/temperatureAlerts.ts)
- [supabaseStore.ts](/smart-bandage/backend/src/store/supabaseStore.ts)
- [schema.sql](/smart-bandage/backend/supabase/schema.sql)
