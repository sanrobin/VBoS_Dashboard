#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include "HX711.h"
#include "time.h"

// WiFi
const char* ssid = "Phoenix";
const char* password = ".sanjay30";

// Firebase URL  (PUT replaces the entire node; PATCH merges fields)
String firebaseBaseURL = "https://vbos-intelligence-default-rtdb.asia-southeast1.firebasedatabase.app/vbos_data.json";

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

// ── Timing (millis-based, non-blocking) ──────────────────────────
unsigned long lastWeightSend = 0;
unsigned long lastFullSend   = 0;
const unsigned long WEIGHT_INTERVAL = 3000;   // weight every 3 s
const unsigned long FULL_INTERVAL   = 10000;  // full payload every 10 s

// ── Helpers ──────────────────────────────────────────────────────
String getTimeNow() {
  struct tm timeinfo;

  if (!getLocalTime(&timeinfo)) {
    return "Time not available";
  }

  char timeString[30];
  strftime(timeString, sizeof(timeString), "%Y-%m-%d %H:%M:%S", &timeinfo);

  return String(timeString);
}

// Send weight-only update (PATCH — merges with existing data)
void sendWeightUpdate(float weight) {
  if (WiFi.status() != WL_CONNECTED) return;

  String currentTime = getTimeNow();
  String jsonData = "{";
  jsonData += "\"Weight\":" + String(weight, 2) + ",";
  jsonData += "\"vehicle_no\":\"" + vehicle_no + "\",";
  jsonData += "\"time\":\"" + currentTime + "\",";
  jsonData += "\"device_status\":\"ONLINE\"";
  jsonData += "}";

  HTTPClient http;
  http.begin(firebaseBaseURL);
  http.addHeader("Content-Type", "application/json");
  int responseCode = http.PATCH(jsonData);

  Serial.print("[Weight] Firebase: ");
  Serial.println(responseCode);
  http.end();
}

// Send full GPS + weight payload (PUT — replaces the node)
void sendFullPayload(float lat, float lng, float weight) {
  if (WiFi.status() != WL_CONNECTED) return;

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

  HTTPClient http;
  http.begin(firebaseBaseURL);
  http.addHeader("Content-Type", "application/json");
  int responseCode = http.PUT(jsonData);

  Serial.print("[Full] Firebase: ");
  Serial.println(responseCode);
  Serial.println(http.getString());
  http.end();
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
  // Feed GPS parser
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  float weight = scale.get_units(10);
  unsigned long now = millis();

  // ── Weight-only update every 3 seconds ───────────────────────
  if (now - lastWeightSend >= WEIGHT_INTERVAL) {
    sendWeightUpdate(weight);
    lastWeightSend = now;
  }

  // ── Full GPS + weight update every 10 seconds ────────────────
  if (now - lastFullSend >= FULL_INTERVAL) {
    if (gps.location.isValid()) {
      float lat = gps.location.lat();
      float lng = gps.location.lng();
      sendFullPayload(lat, lng, weight);
    } else {
      Serial.println("Waiting for GPS signal...");
    }
    lastFullSend = now;
  }
}
