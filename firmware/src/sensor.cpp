#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <SparkFun_TMP117.h>
#include <time.h>

const char* ssid = "mineplex";
const char* password = "ezpassword123";
const char* backendUrl = "http://10.0.0.37:3000/api/readings";
const char* ntpServer = "pool.ntp.org";

TMP117 sensor;
const char* deviceId = "esp32-thing-plus-1";
bool hasEpochOffset = false;
int64_t epochOffsetMs = 0;

bool waitForTimeSync(unsigned long timeoutMs = 15000) {
  unsigned long start = millis();
  while (time(nullptr) < 1000000000) {
    if (millis() - start > timeoutMs) {
      return false;
    }
    delay(250);
    Serial.print(".");
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
  delay(2000);

  Wire.begin(21, 22);

  if (!sensor.begin()) {
    Serial.println("Sensor not detected");
    while (1) {
      delay(1000);
      Serial.println("Still not detecting sensor...");
    }
  }

  Serial.print("Connecting to WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConnected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());

  Serial.print("Syncing time...");
  configTime(0, 0, ntpServer);
  if (waitForTimeSync()) {
    epochOffsetMs = static_cast<int64_t>(time(nullptr)) * 1000LL - static_cast<int64_t>(millis());
    hasEpochOffset = true;
    Serial.println("\nTime synced");
  } else {
    Serial.println("\nTime sync failed; latency timestamps will fall back on backend time");
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected");
    delay(2000);
    return;
  }

  float tempC = sensor.readTempC();
  float tempF = sensor.readTempF();

  uint64_t timestamp = currentEpochMillis();

  HTTPClient http;
  http.begin(backendUrl);
  http.addHeader("Content-Type", "application/json");

  char timestampBuffer[24];
  snprintf(timestampBuffer, sizeof(timestampBuffer), "%llu", timestamp);

  String body = "{";
  body += "\"device_id\":\"" + String(deviceId) + "\",";
  body += "\"temperature_c\":" + String(tempC, 2) + ",";
  body += "\"timestamp\":" + String(timestampBuffer);
  body += "}";

  Serial.print("TempF: ");
  Serial.print(tempF);
  Serial.print(" | TempC: ");
  Serial.print(tempC);
  Serial.print(" | timestamp_ms: ");
  Serial.println(timestampBuffer);

  int httpResponseCode = http.POST(body);

  if (httpResponseCode > 0) {
    if (httpResponseCode >= 200 && httpResponseCode < 300) {
      Serial.print("POST status: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.println("POST returned a non-2xx status");
      Serial.println(httpResponseCode);
    }
  } else {
    Serial.println("POST failed");
  }

  http.end();

  delay(3000);
}
