#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include "HX711.h"
#include "time.h"
// WiFi
const char* ssid = "SUN4147";
const char* password = "459&q59F";

// Firebase URL
String firebaseURL = "https://vbos-intelligence-default-rtdb.asia-southeast1.firebasedatabase.app/vbos_data.json";

// GPS
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);
#define GPS_RX 19
#define GPS_TX 21

// Load Cell
#define DOUT 4
#define SCK 5
HX711 scale;

float calibration_factor = -7050;
String vehicle_no = "TN60P0829";
String getTimeNow() {
  struct tm timeinfo;

  if (!getLocalTime(&timeinfo)) {
    return "Time not available";
  }

  char timeString[30];
  strftime(timeString, sizeof(timeString), "%Y-%m-%d %H:%M:%S", &timeinfo);

  return String(timeString);
}
void setup() {
  Serial.begin(115200);

  gpsSerial.begin(115200, SERIAL_8N1, GPS_RX, GPS_TX);

  scale.begin(DOUT, SCK);
  scale.set_scale(calibration_factor);
  scale.tare();

  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected");
  Serial.println("VBoS System Started...");
  configTime(19800, 0, "pool.ntp.org", "time.nist.gov"); 
// 19800 = India time UTC+5:30


}

void loop() {
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  float weight = scale.get_units(10);

  if (gps.location.isValid()) {
    float lat = gps.location.lat();
    float lng = gps.location.lng();

    String currentTime = getTimeNow();

    String jsonData = "{";
    jsonData += "\"lat\":" + String(lat, 6) + ",";
    jsonData += "\"Long\":" + String(lng, 6) + ",";
    jsonData += "\"Weight\":" + String(weight, 2) + ",";
    jsonData += "\"vehicle_no\":\"" + vehicle_no + "\",";
    jsonData += "\"time\":\"" + currentTime + "\",";
    jsonData += "\"device_status\":\"ONLINE\"";
    jsonData += "}";

    Serial.println(jsonData);

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(firebaseURL);
      http.addHeader("Content-Type", "application/json");

      int responseCode = http.POST(jsonData);

      Serial.print("Firebase Response: ");
      Serial.println(responseCode);

Serial.println(http.getString());
      http.end();
    }
  } else {
    Serial.println("Waiting for GPS signal...");
  }

  delay(10000); // uploads every 10 seconds
}