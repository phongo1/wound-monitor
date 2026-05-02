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
- Use a 5-reading moving average for alert evaluation.
- If baseline is not set, estimate baseline from the first 20 plausible readings.

If a device has no `device_alert_settings` row, the backend uses defaults from [defaults.ts](/Users/phongle/dev/smart-bandage/backend/src/alerting/defaults.ts).

If a device has no `baseline_temperature_c`, the heuristic returns no alert.

## Warning Rules

`warning` can be raised by either of these:

- **Cold spot warning**: a cold-spot condition is present in neighboring smoothed readings (not a single isolated drop).
- **Inflammation warning**: at least `8` of the last `10` smoothed readings are above baseline by `+0.5 C`, and recent trend is positive.

## Risk Rule

`risk` is raised when both are true:

- at least `8` of the last `10` plausible readings are above baseline by `+1.0 C`
- overall rise across that 10-reading window is at least `+1.0 C`

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
- `inflammation_warning`
- `inflammation_risk`

Severity mapping:

- `cold_spot` => `warning`
- `inflammation_warning` => `warning`
- `inflammation_risk` => `risk`

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
