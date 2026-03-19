#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <SparkFun_TMP117.h>

const char* ssid = "mineplex";
const char* password = "ezpassword123";
const char* backendUrl = "http://10.0.0.228:3000/api/readings";

TMP117 sensor;
const char* deviceId = "esp32-thing-plus-1";

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
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected");
    delay(2000);
    return;
  }

  float tempC = sensor.readTempC();
  float tempF = sensor.readTempF();

  unsigned long timestamp = millis() / 1000;

  HTTPClient http;
  http.begin(backendUrl);
  http.addHeader("Content-Type", "application/json");

  String body = "{";
  body += "\"device_id\":\"" + String(deviceId) + "\",";
  body += "\"temperature_c\":" + String(tempC, 2) + ",";
  body += "\"timestamp\":" + String(timestamp);
  body += "}";

  int httpResponseCode = http.POST(body);

  Serial.print("TempF: ");
  Serial.print(tempF);
  Serial.print(" | TempC: ");
  Serial.print(tempC);
  Serial.print(" | POST status: ");
  Serial.println(httpResponseCode);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println(response);
  } else {
    Serial.println("POST failed");
  }

  http.end();

  delay(3000);
}