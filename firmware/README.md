# Firmware (ESP32 + TMP117)

This folder is a minimal skeleton for SparkFun Thing Plus ESP32 WROOM firmware.

## Expected behavior (after you implement TODOs)

1. Initialize TMP117 over I2C/Qwiic
2. Connect ESP32 to WiFi
3. Read temperature in Celsius
4. POST JSON to backend:

```json
{
  "device_id": "bandage_01",
  "temperature_c": 36.7,
  "timestamp": 1712345678
}
```

## Notes

- Keep hardware and credentials logic simple while learning.
- Current code intentionally includes placeholder values and TODOs.
