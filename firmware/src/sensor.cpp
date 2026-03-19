#include <WiFi.h>
#include <Wire.h>
#include <SparkFun_TMP117.h>

const char* ssid = "mineplex";
const char* password = "ezpassword123";

WiFiServer server(80);
TMP117 sensor;

void setup() {
  Serial.begin(115200);
  delay(2000);

  Wire.begin(21, 22);

  if (!sensor.begin()) {
    Serial.println("Sensor not detected");
    while (1);
  }

  // Connect to wifi
  Serial.print("Connecting to WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConnected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  server.begin();
}

void loop() {
  WiFiClient client = server.available();

  if (client) {
    float tempF = sensor.readTempF();

    client.println("HTTP/1.1 200 OK");
    client.println("Content-type:text/html");
    client.println();

    client.println("<html><body>");
    client.println("<h1>ESP32 Temperature</h1>");
    client.print("<p>");
    client.print(tempF);
    client.println(" F</p>");
    client.println("</body></html>");

    client.stop();
  }
}
