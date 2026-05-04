#include <Arduino.h>
#include <time.h>

#include "sensor.h"
#include "wifi.h"

// TODO: Move credentials to a safer approach (secrets file/env/provisioning).
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// For local dev, this might be your computer's LAN IP: e.g. http://192.168.1.50:3000
const char* BACKEND_BASE_URL = "http://YOUR_BACKEND_HOST:3000";
const char* DEVICE_ID = "bandage_01";
const char* NTP_SERVER = "pool.ntp.org";

unsigned long lastSendMs = 0;
const unsigned long SEND_INTERVAL_MS = 5000;
bool hasEpochOffset = false;
int64_t epochOffsetMs = 0;
uint32_t readingSequenceNumber = 0;

bool waitForTimeSync(unsigned long timeoutMs = 15000) {
  unsigned long start = millis();
  while (time(nullptr) < 1000000000) {
    if (millis() - start > timeoutMs) {
      return false;
    }
    delay(250);
  }
  return true;
}

uint64_t currentEpochMillis() {
  if (!hasEpochOffset) {
    return 0;
  }
  return static_cast<uint64_t>(epochOffsetMs + static_cast<int64_t>(millis()));
}

void setup() {
  Serial.begin(115200);

  if (!sensorInit()) {
    Serial.println("Sensor init failed");
  }

  if (!wifiConnect(WIFI_SSID, WIFI_PASSWORD)) {
    Serial.println("WiFi connect failed");
  } else {
    Serial.println("WiFi connected");
    configTime(0, 0, NTP_SERVER);
    if (waitForTimeSync()) {
      epochOffsetMs = static_cast<int64_t>(time(nullptr)) * 1000LL - static_cast<int64_t>(millis());
      hasEpochOffset = true;
      Serial.println("Time synced");
    } else {
      Serial.println("Time sync failed");
    }
  }
}

void loop() {
  unsigned long now = millis();
  if (now - lastSendMs < SEND_INTERVAL_MS) {
    return;
  }
  lastSendMs = now;

  float tempC = readTemperatureC();

  uint64_t timestamp = currentEpochMillis();

  readingSequenceNumber++;
  bool ok = sendReading(
    BACKEND_BASE_URL,
    DEVICE_ID,
    tempC,
    timestamp,
    readingSequenceNumber
  );

  Serial.print(ok ? "Reading sent, seq=" : "Failed to send reading, seq=");
  Serial.println(readingSequenceNumber);
}
