#include <Arduino.h>

#include "sensor.h"
#include "wifi.h"

// TODO: Move credentials to a safer approach (secrets file/env/provisioning).
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// For local dev, this might be your computer's LAN IP: e.g. http://192.168.1.50:3000
const char* BACKEND_BASE_URL = "http://YOUR_BACKEND_HOST:3000";
const char* DEVICE_ID = "bandage_01";

unsigned long lastSendMs = 0;
const unsigned long SEND_INTERVAL_MS = 5000;

void setup() {
  Serial.begin(115200);

  if (!sensorInit()) {
    Serial.println("Sensor init failed");
  }

  if (!wifiConnect(WIFI_SSID, WIFI_PASSWORD)) {
    Serial.println("WiFi connect failed");
  } else {
    Serial.println("WiFi connected");
  }
}

void loop() {
  unsigned long now = millis();
  if (now - lastSendMs < SEND_INTERVAL_MS) {
    return;
  }
  lastSendMs = now;

  float tempC = readTemperatureC();

  // TODO: Replace millis-based timestamp with real epoch time from NTP/RTC.
  unsigned long timestamp = millis() / 1000;

  bool ok = sendReading(BACKEND_BASE_URL, DEVICE_ID, tempC, timestamp);
  Serial.println(ok ? "Reading sent" : "Failed to send reading");
}
