#pragma once

#include <stdint.h>

bool wifiConnect(const char* ssid, const char* password, unsigned long timeoutMs = 15000);
bool sendReading(
  const char* backendUrl,
  const char* deviceId,
  float temperatureC,
  uint64_t timestamp,
  uint32_t sequenceNumber
);
