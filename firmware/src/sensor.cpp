#include <Wire.h>
#include <SparkFun_TMP117.h>

TMP117 sensor;

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("Starting...");

  Wire.begin(21, 22);   // ESP32 Thing Plus I2C pins

  Serial.println("Trying to find sensor...");

  if (!sensor.begin()) {
    Serial.println("TMP117 not detected. Check wiring.");
    while (1) {
      delay(1000);
      Serial.println("Still not detecting TMP117...");
    }
  }

  Serial.println("TMP117 Temperature Sensor Ready");
}

void loop() {
  float temperature = sensor.readTempF();
  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println(" F");
  delay(1000);
}
