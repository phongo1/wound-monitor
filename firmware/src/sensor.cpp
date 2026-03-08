#include "sensor.h"

// TODO: Add I2C + TMP117 library includes here (for SparkFun TMP117 over Qwiic).
// Example later: initialize Wire and configure sensor in sensorInit().

bool sensorInit() {
  // TODO: Implement real TMP117 initialization.
  // Return true when sensor is detected and ready.
  return true;
}

float readTemperatureC() {
  // TODO: Replace with real TMP117 temperature read.
  // Placeholder for early end-to-end wiring tests.
  return 36.7f;
}
