#include "wifi.h"

#include <HTTPClient.h>
#include <WiFi.h>

bool wifiConnect(const char* ssid, const char* password, unsigned long timeoutMs) {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > timeoutMs) {
      return false;
    }
    delay(250);
  }

  return true;
}

bool sendReading(const char* backendUrl, const char* deviceId, float temperatureC, uint64_t timestamp) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  String endpoint = String(backendUrl) + "/api/readings";

  http.begin(endpoint);
  http.addHeader("Content-Type", "application/json");

  char timestampBuffer[24];
  snprintf(timestampBuffer, sizeof(timestampBuffer), "%llu", timestamp);

  String payload = "{\"device_id\":\"" + String(deviceId) +
                   "\",\"temperature_c\":" + String(temperatureC, 2) +
                   ",\"timestamp\":" + String(timestampBuffer) + "}";

  int statusCode = http.POST(payload);

  http.end();

  return statusCode >= 200 && statusCode < 300;
}
