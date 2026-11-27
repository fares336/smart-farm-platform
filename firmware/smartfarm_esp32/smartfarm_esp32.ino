/*
 * Smart Farm – ESP32 soil robot firmware
 *
 * Sends soil readings (moisture, pH, EC, temperature) for a zone (A1..P16) to the
 * Smart Farm server over Wi-Fi/HTTPS, authenticated with a per-device key.
 *
 * USB is only used to flash this sketch and to read the Serial monitor.
 * Data reaches the platform exclusively through Wi-Fi + the HTTPS API below.
 *
 * Libraries (Arduino Library Manager):
 *   - ArduinoJson (v7)           by Benoit Blanchon
 *   - OneWire + DallasTemperature (if you use a DS18B20 temperature probe)
 * Board: "ESP32 Dev Module" (esp32 core >= 2.0)
 *
 * See docs/ESP32.md for wiring, calibration and the API contract.
 */
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <Preferences.h>

// ---------- Configuration (fill in from the Robot page / pairing QR) ----------
const char* WIFI_SSID     = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "https://your-server.example.com"; // no trailing slash
const char* DEVICE_ID     = "SF-XXXXXXXX";
const char* DEVICE_KEY    = "sfk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const char* FIRMWARE      = "1.0.0";

// Set to true ONLY for local testing against a self-signed/plain HTTP server.
const bool  INSECURE_TLS  = false;

// ---------- Sensor pins (adjust to your wiring) ----------
const int PIN_MOISTURE = 34;   // capacitive soil moisture sensor (analog)
const int PIN_PH       = 35;   // analog pH module (e.g. DFRobot SEN0161 / SEN0169)
const int PIN_EC       = 32;   // analog EC/TDS module (e.g. DFRobot DFR0300)
const int PIN_BATTERY  = 33;   // battery voltage through a divider (optional, -1 to disable)

// ---------- Calibration (MUST be measured for your own sensors) ----------
// Moisture: raw ADC reading in dry air and in water-saturated soil.
int   MOISTURE_RAW_DRY = 3200;
int   MOISTURE_RAW_WET = 1300;
// pH: two-point calibration with pH 7.00 and pH 4.00 buffers (voltage in V).
float PH_V_AT_7 = 1.50;
float PH_V_AT_4 = 2.03;
// EC: K factor from calibration with a 1.413 mS/cm standard solution.
float EC_K = 1.0;
// Battery divider ratio and voltage range for percentage.
float BAT_DIVIDER = 2.0, BAT_V_EMPTY = 3.3, BAT_V_FULL = 4.2;

// ---------- Survey plan ----------
// The robot reports which zone it is in. Without GPS, the operator places the robot
// in the zone (or a path planner sets it). Here we read the zone from Serial input,
// e.g. type "C7" + Enter in the Serial monitor. With a GPS module you may instead
// send "gps": {"lat":..., "lng":...} and omit zone_id.
String currentZone = "A1";
const unsigned long MEASURE_INTERVAL_MS = 60UL * 1000UL;
const unsigned long HEARTBEAT_INTERVAL_MS = 5UL * 60UL * 1000UL;

Preferences prefs;
uint32_t messageCounter = 0;
unsigned long lastMeasure = 0, lastHeartbeat = 0;

float readAnalogVoltage(int pin, int samples = 20) {
  long sum = 0;
  for (int i = 0; i < samples; i++) { sum += analogRead(pin); delay(5); }
  return (sum / (float)samples) * 3.3f / 4095.0f;
}

float readMoisturePct() {
  long sum = 0;
  for (int i = 0; i < 20; i++) { sum += analogRead(PIN_MOISTURE); delay(5); }
  float raw = sum / 20.0f;
  float pct = (MOISTURE_RAW_DRY - raw) * 100.0f / (MOISTURE_RAW_DRY - MOISTURE_RAW_WET);
  return constrain(pct, 0.0f, 100.0f);
}

float readPh() {
  float v = readAnalogVoltage(PIN_PH);
  float slope = (7.0f - 4.0f) / (PH_V_AT_7 - PH_V_AT_4);
  float ph = 7.0f + (v - PH_V_AT_7) * slope;
  return ph;
}

float readEcDsM(float tempC) {
  float v = readAnalogVoltage(PIN_EC);
  // Generic DFR0300 polynomial (mS/cm at 25 °C) with temperature compensation; mS/cm == dS/m.
  float ec25 = (133.42f * v * v * v - 255.86f * v * v + 857.39f * v) / 1000.0f * EC_K;
  float comp = 1.0f + 0.02f * (tempC - 25.0f);
  return ec25 / comp;
}

float readSoilTempC() {
  // Replace with your temperature sensor (e.g. DS18B20 via DallasTemperature).
  // Return NAN when no sensor is installed so the server stores "missing", not a fake value.
  return NAN;
}

int readBatteryPct() {
  if (PIN_BATTERY < 0) return -1;
  float v = readAnalogVoltage(PIN_BATTERY) * BAT_DIVIDER;
  return (int)constrain((v - BAT_V_EMPTY) * 100.0f / (BAT_V_FULL - BAT_V_EMPTY), 0.0f, 100.0f);
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) { delay(500); Serial.print('.'); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " FAILED");
  if (WiFi.status() == WL_CONNECTED) configTime(0, 0, "pool.ntp.org", "time.google.com");
}

time_t nowEpoch() {
  time_t now = time(nullptr);
  return now > 1700000000 ? now : 0; // 0 = clock not synced yet
}

int postJson(const String& path, const String& body, String& response) {
  HTTPClient http;
  WiFiClientSecure secure;
  String url = String(SERVER_URL) + path;
  bool ok;
  if (url.startsWith("https://")) {
    if (INSECURE_TLS) secure.setInsecure();
    else secure.setCACertBundle(nullptr); // uses the built-in Mozilla CA bundle on esp32 core >= 2.0.6
    ok = http.begin(secure, url);
  } else {
    ok = http.begin(url);
  }
  if (!ok) return -1;
  http.setTimeout(15000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("Authorization", String("Bearer ") + DEVICE_KEY);
  int code = http.POST(body);
  response = http.getString();
  http.end();
  return code;
}

void sendHeartbeat(const char* error = nullptr) {
  JsonDocument doc;
  doc["firmware"] = FIRMWARE;
  doc["zone_id"] = currentZone;
  int bat = readBatteryPct();
  if (bat >= 0) doc["battery"] = bat;
  if (error) doc["error"] = error;
  String body, resp;
  serializeJson(doc, body);
  int code = postJson("/api/device/v1/heartbeat", body, resp);
  Serial.printf("Heartbeat -> %d\n", code);
}

void sendMeasurement() {
  float temp = readSoilTempC();
  JsonDocument doc;
  doc["zone_id"] = currentZone;
  doc["moisture"] = readMoisturePct();
  doc["ph"] = readPh();
  doc["ec"] = readEcDsM(isnan(temp) ? 25.0f : temp);
  if (!isnan(temp)) doc["temperature"] = temp;
  time_t ts = nowEpoch();
  if (ts) doc["timestamp"] = (long)ts;
  messageCounter++;
  prefs.putUInt("msg", messageCounter);
  doc["message_id"] = String(DEVICE_ID) + "-" + String(messageCounter);
  int bat = readBatteryPct();
  if (bat >= 0) doc["battery"] = bat;

  String body, resp;
  serializeJson(doc, body);
  Serial.println("POST " + body);
  // Retry with the SAME message_id so the server can deduplicate.
  for (int attempt = 0; attempt < 3; attempt++) {
    int code = postJson("/api/device/v1/measurements", body, resp);
    Serial.printf("Measurement -> %d %s\n", code, resp.c_str());
    if (code == 201 || code == 200) return;
    if (code == 401 || code == 422) return; // credentials or data problem: retrying will not help
    delay(2000 * (attempt + 1));
  }
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  prefs.begin("smartfarm", false);
  messageCounter = prefs.getUInt("msg", 0);
  connectWifi();
  sendHeartbeat();
  Serial.println("Type a zone code (A1..P16) and press Enter to set the current zone.");
}

void loop() {
  if (Serial.available()) {
    String z = Serial.readStringUntil('\n');
    z.trim();
    z.toUpperCase();
    if (z.length() >= 2 && z.length() <= 3 && z[0] >= 'A' && z[0] <= 'P') { currentZone = z; Serial.println("Zone set to " + z); }
  }
  connectWifi();
  if (WiFi.status() != WL_CONNECTED) { delay(5000); return; }
  if (millis() - lastMeasure >= MEASURE_INTERVAL_MS || lastMeasure == 0) { lastMeasure = millis(); sendMeasurement(); }
  if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) { lastHeartbeat = millis(); sendHeartbeat(); }
  delay(200);
}
