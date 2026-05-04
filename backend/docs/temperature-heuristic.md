# Temperature Heuristic

This backend uses a moving-average based wound temperature heuristic:

1. A **sustained cold spot** can be treated as `warning`.
2. A **sustained mild-above-baseline trend** can be treated as `warning`.
3. A **sustained strong-above-baseline rise** is treated as `risk`.

## Why

The model assumes these temperature patterns are meaningful:

- A sustained drop below baseline can indicate a local cold spot.
- Sustained elevations above baseline can indicate inflammation risk.
- Isolated spikes/dropouts should be suppressed by smoothing and persistence rules.

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

Reading pre-processing rules:

- Ignore impossible sensor values outside `30 C` to `45 C`.
- Use a 20-reading moving average for alert evaluation.
- If baseline is not set, estimate baseline from a 10% trimmed mean of the first 400 plausible readings.
- These count-based windows assume the firmware sends a reading about every 3 seconds.

If a device has no `device_alert_settings` row, the backend uses defaults from [defaults.ts](../src/alerting/defaults.ts).

If a device has no `baseline_temperature_c`, the heuristic returns no alert.

## Warning Rules

`warning` can be raised by either of these:

- **Cold spot warning**: at least `120` of the last `200` smoothed readings are below baseline by the cold-spot threshold.
- **Inflammation warning**: at least `140` of the last `200` smoothed readings are above baseline by `+0.5 C`, and recent trend is positive.

## Risk Rule

`risk` is raised when either rapid rise or sustained severe elevation is present:

- **Rapid rise**: at least `160` of the last `200` smoothed readings are above baseline by `+1.0 C`, and overall rise across that window is at least `+0.75 C`.
- **Sustained severe elevation**: at least `160` of the last `200` smoothed readings are above baseline by `+1.75 C`.

## Windowing

The backend only evaluates readings in the trailing `window_minutes` window ending at the reading that was just inserted.

That means:

- old cold spots outside the window do not count
- alerting is tied to recent temperature behavior
- inserting an older backfilled reading evaluates only the window ending at that reading's timestamp

## Reading Selection

Within the active window:

- the backend finds the **latest** reading
- it builds smoothed readings from plausible values
- it evaluates alert rules against the latest smoothed readings

## Alert Types

The backend writes these alert kinds:

- `cold_spot`
- `inflammation_warning`
- `inflammation_risk`

Severity mapping:

- `cold_spot` => `warning`
- `inflammation_warning` => `warning`
- `inflammation_risk` => `risk`

## Current Defaults

Current defaults from [defaults.ts](../src/alerting/defaults.ts):

- `window_minutes = 120`
- `min_rebound_readings = 2`
- `cold_spot_delta_c = 1.5`
- `inflammation_delta_c = 0.5`
- `rebound_rate_c_per_hour = 0.6`

These are product defaults, not clinical validation.

## Implementation Reference

Main logic lives in:

- [temperatureAlerts.ts](../src/services/temperatureAlerts.ts)
- [supabaseStore.ts](../src/store/supabaseStore.ts)
- [schema.sql](../supabase/schema.sql)
