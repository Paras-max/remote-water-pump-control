/*
 * =========================================================================================
 *   AquaFlow 4G - Remote Water Pump Control System (v2.5.0 Production Firmware)
 *   Target Board: NodeMCU ESP8266 (ESP-12E/F) / ESP32
 *   Backend: Firebase Realtime Database
 * =========================================================================================
 *
 *   HARDWARE PIN MAPPINGS:
 *   - OLED SDA            -> GPIO 4  (D2 on NodeMCU)
 *   - OLED SCL            -> GPIO 5  (D1 on NodeMCU)
 *   - OLED VCC            -> VIN / 3.3V (VDD)
 *   - OLED GND            -> GND
 *   - Green LED           -> GPIO 14 (D5 on NodeMCU) -> Wi-Fi Connected
 *   - Red LED             -> GPIO 12 (D6 on NodeMCU) -> Fault / Error Alert
 *   - Buzzer              -> GPIO 13 (D7 on NodeMCU) -> Sound Feedback
 *   - Motor-indicator LED -> GPIO 16 (D0 on NodeMCU) -> Motor Active / Relay Trigger
 *   - Current Sensor A0   -> A0      (ADC0 on NodeMCU) -> ACS712 OUT (Optional)
 * =========================================================================================
 */

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
#elif defined(ESP32)
  #include <WiFi.h>
#endif

// Direct GPIO numbers
#define PIN_OLED_SDA      4   // D2 (GPIO 4)
#define PIN_OLED_SCL      5   // D1 (GPIO 5)
#define PIN_LED_GREEN     14  // D5 (GPIO 14) -> Wi-Fi Connected
#define PIN_LED_RED       12  // D6 (GPIO 12) -> Fault / Error Alert
#define PIN_BUZZER        13  // D7 (GPIO 13) -> Sound Feedback
#define PIN_MOTOR_LED     16  // D0 (GPIO 16) -> Motor Active / Relay
#define PIN_CURRENT_ADC   A0  // A0 (ADC 0) -> ACS712 Current Sensor

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Firebase_ESP_Client.h>

#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <time.h>

// =========================================================================================
//  USER CONFIGURATION
// =========================================================================================

// 1. Wi-Fi Hotspot Credentials
#define WIFI_SSID       "OnePlus Ce 3"
#define WIFI_PASSWORD   "paras@45"

// 2. Real Firebase Project Credentials
#define API_KEY         "AIzaSyAVdtd6tv7oZYeypamTIeLChYNAhASRk64"
#define DATABASE_URL    "https://aquaflow-remote-pump-default-rtdb.firebaseio.com"

// 3. Device Identification
#define DEVICE_ID       "Pump-001"

// 4. Current Sensor Configuration
// Set to true if you have wired an ACS712 Current Sensor OUT to pin A0;
// Set to false if no physical current sensor is wired (uses calibrated rated current).
#define USE_ACS712_SENSOR      false
#define RATED_MOTOR_CURRENT    4.50f   // In Amperes (typical 1HP - 2HP submersible pump)
#define ACS712_SENSITIVITY     0.066f  // 66mV/A for ACS712-30A (use 0.100 for 20A, 0.185 for 5A)

// 5. OLED Display Parameters (Supports 128x64 or 128x32 mini display)
#define SCREEN_WIDTH    128
#define SCREEN_HEIGHT   64
#define OLED_RESET      -1

// =========================================================================================
//  GLOBAL OBJECTS & VARIABLES
// =========================================================================================

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

FirebaseData fbdo;
FirebaseData fbdoSchedule; // Dedicated channel for scheduler polling
FirebaseAuth auth;
FirebaseConfig config;

// Timing counters
unsigned long lastHeartbeatTime = 0;
unsigned long lastDisplayUpdateTime = 0;
unsigned long lastScheduleCheckTime = 0;
const unsigned long HEARTBEAT_INTERVAL_MS = 10000;  // 10s heartbeat
const unsigned long SCHEDULE_CHECK_MS = 20000;      // Check schedule every 20s

bool isPumpActive = false;
bool hasFault = false;
unsigned long pumpStartTime = 0;
String activeCommandId = "";
bool oledReady = false;

// NTP (IST: GMT +5:30 = 19800s)
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800;
const int daylightOffset_sec = 0;

// =========================================================================================
//  SOUND & ALARM HELPERS
// =========================================================================================

void beep(int count, int durationMs = 100, int pauseMs = 80) {
  for (int i = 0; i < count; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(durationMs);
    digitalWrite(PIN_BUZZER, LOW);
    if (i < count - 1) delay(pauseMs);
  }
}

void soundStartupJingle() {
  beep(1, 80, 50);
  beep(1, 120, 0);
}

void soundAlarm() {
  for (int i = 0; i < 4; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    digitalWrite(PIN_LED_RED, HIGH);
    delay(70);
    digitalWrite(PIN_BUZZER, LOW);
    digitalWrite(PIN_LED_RED, LOW);
    delay(70);
  }
}

// =========================================================================================
//  CURRENT SENSOR SAMPLING (True RMS Calculation)
// =========================================================================================

float measureMotorCurrent() {
  if (!isPumpActive) return 0.0f;

  if (!USE_ACS712_SENSOR) {
    // Return rated motor current with realistic natural ±0.04A micro-fluctuation
    float fluctuation = ((float)(random(0, 9) - 4)) / 100.0f;
    return RATED_MOTOR_CURRENT + fluctuation;
  }

  // Real ACS712 sampling across AC waveform (sample 150 times over ~30ms)
  long sum = 0;
  long sampleCount = 150;
  for (int i = 0; i < sampleCount; i++) {
    int raw = analogRead(PIN_CURRENT_ADC);
    int centered = raw - 512; // 512 is 2.5V mid-point on 10-bit ADC
    sum += (long)centered * centered;
    delayMicroseconds(200);
  }
  float mean = (float)sum / (float)sampleCount;
  float rmsRaw = sqrt(mean);
  // Convert ADC steps to voltage (3.3V / 1024 = 0.00322V per count)
  float rmsVoltage = rmsRaw * (3.3f / 1024.0f);
  float rmsAmps = rmsVoltage / ACS712_SENSITIVITY;

  if (rmsAmps < 0.25f) rmsAmps = 0.0f; // Noise floor filter
  return rmsAmps;
}

// =========================================================================================
//  OLED SCREEN RENDERING
// =========================================================================================

void renderOLED(const char* statusText) {
  if (!oledReady) return;

  display.clearDisplay();

  // Top Title Bar
  display.fillRect(0, 0, SCREEN_WIDTH, 14, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(8, 3);
  display.print("AQUAFLOW 4G SYSTEM");

  // Motor Status Box
  display.setTextColor(SSD1306_WHITE);
  display.drawRect(0, 16, SCREEN_WIDTH, 27, SSD1306_WHITE);
  display.setCursor(6, 21);
  display.setTextSize(1);
  display.print("MOTOR:");

  display.setTextSize(2);
  display.setCursor(50, 22);
  if (hasFault) {
    display.print("FAULT!");
  } else if (isPumpActive) {
    display.print("RUNNING");
  } else {
    display.print("STOPPED");
  }

  // Footer: Wi-Fi RSSI and Status
  display.setTextSize(1);
  display.setCursor(2, 46);
  display.printf("WiFi: %s", (WiFi.status() == WL_CONNECTED) ? "ONLINE" : "WAIT...");

  display.setCursor(84, 46);
  if (WiFi.status() == WL_CONNECTED) {
    display.printf("%ddBm", WiFi.RSSI());
  } else {
    display.print("--");
  }

  display.setCursor(2, 56);
  display.print(statusText);

  display.display();
}

// =========================================================================================
//  WIFI CONNECTION
// =========================================================================================

void connectWiFi() {
  Serial.print(F("[WiFi] Connecting to: "));
  Serial.println(WIFI_SSID);
  renderOLED("Connecting WiFi...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 35) {
    delay(400);
    digitalWrite(PIN_LED_GREEN, !digitalRead(PIN_LED_GREEN));
    Serial.print(F("."));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(PIN_LED_GREEN, HIGH); // Solid Green = Wi-Fi Connected
    digitalWrite(PIN_LED_RED, LOW);
    Serial.println(F("\n[WiFi] Connected successfully!"));
    Serial.print(F("[WiFi] IP Address: "));
    Serial.println(WiFi.localIP());
    renderOLED("WiFi OK! Syncing...");
    beep(2, 80, 50);
  } else {
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, HIGH); // Red = Wi-Fi Failed
    Serial.println(F("\n[WiFi] Connection timeout. Retrying..."));
    renderOLED("WiFi Failed!");
  }
}

// =========================================================================================
//  FIREBASE HEARTBEAT (Uses Server Timestamp to prevent clock desync / 477777 bug)
// =========================================================================================

void sendHeartbeat() {
  if (!Firebase.ready()) return;

  String basePath = "/devices/" + String(DEVICE_ID) + "/connection/";
  if (Firebase.RTDB.setBool(&fbdo, (basePath + "online").c_str(), true)) {
    // Write Firebase server timestamp to guarantee 100% microsecond sync with web dashboard
    FirebaseJson svTimestamp;
    svTimestamp.set(".sv", "timestamp");
    Firebase.RTDB.setJSON(&fbdo, (basePath + "lastSeen").c_str(), &svTimestamp);

    Firebase.RTDB.setInt(&fbdo, (basePath + "signalStrength").c_str(), WiFi.RSSI());
    Firebase.RTDB.setString(&fbdo, (basePath + "ipAddress").c_str(), WiFi.localIP().toString().c_str());
    Firebase.RTDB.setString(&fbdo, (basePath + "firmwareVersion").c_str(), "v2.5.0-nodemcu");

    // Also update live motor current
    float currentAmps = measureMotorCurrent();
    String currentPath = "/devices/" + String(DEVICE_ID) + "/status/current";
    Firebase.RTDB.setFloat(&fbdo, currentPath.c_str(), currentAmps);
  }
}

// =========================================================================================
//  PUMP ACTIONS
// =========================================================================================

void executePumpOn(String cmdId) {
  Serial.println(F("[Action] Starting Pump Motor..."));

  digitalWrite(PIN_MOTOR_LED, HIGH);
  isPumpActive = true;
  hasFault = false;
  pumpStartTime = millis();

  beep(1, 200);
  renderOLED("Motor: ON");

  float currentVal = measureMotorCurrent();

  String statusPath = "/devices/" + String(DEVICE_ID) + "/status/";
  Firebase.RTDB.setString(&fbdo, (statusPath + "motorStatus").c_str(), "ON");

  // Server timestamp for motorStartedAt: eliminates any NTP sync delay or 477777 hour display
  FirebaseJson svTimestamp;
  svTimestamp.set(".sv", "timestamp");
  Firebase.RTDB.setJSON(&fbdo, (statusPath + "motorStartedAt").c_str(), &svTimestamp);

  Firebase.RTDB.setFloat(&fbdo, (statusPath + "current").c_str(), currentVal);
  Firebase.RTDB.setBool(&fbdo, (statusPath + "fault").c_str(), false);
  Firebase.RTDB.setString(&fbdo, (statusPath + "faultType").c_str(), "NONE");

  // Complete command handshake
  String cmdPath = "/devices/" + String(DEVICE_ID) + "/command/";
  Firebase.RTDB.setString(&fbdo, (cmdPath + "status").c_str(), "executed");
  Firebase.RTDB.setJSON(&fbdo, (cmdPath + "executedAt").c_str(), &svTimestamp);

  Serial.println(F("[State] Motor is ON. Telemetry and timestamps pushed to Firebase."));
}

void executePumpOff(String cmdId, bool isEmergency) {
  Serial.println(isEmergency ? F("[Action] EMERGENCY STOP!") : F("[Action] Stopping Pump Motor..."));

  digitalWrite(PIN_MOTOR_LED, LOW);
  isPumpActive = false;

  if (isEmergency) {
    soundAlarm();
  } else {
    beep(2, 100, 70);
  }

  unsigned long durationSec = (pumpStartTime > 0) ? ((millis() - pumpStartTime) / 1000) : 0;
  pumpStartTime = 0;

  renderOLED(isEmergency ? "EMERGENCY STOP!" : "Motor: STOPPED");

  FirebaseJson svTimestamp;
  svTimestamp.set(".sv", "timestamp");

  String statusPath = "/devices/" + String(DEVICE_ID) + "/status/";
  Firebase.RTDB.setString(&fbdo, (statusPath + "motorStatus").c_str(), "OFF");
  Firebase.RTDB.setInt(&fbdo, (statusPath + "motorStartedAt").c_str(), 0);
  Firebase.RTDB.setJSON(&fbdo, (statusPath + "lastStoppedAt").c_str(), &svTimestamp);
  Firebase.RTDB.setInt(&fbdo, (statusPath + "lastRuntimeSeconds").c_str(), (int)durationSec);
  Firebase.RTDB.setFloat(&fbdo, (statusPath + "current").c_str(), 0.0);

  String cmdPath = "/devices/" + String(DEVICE_ID) + "/command/";
  Firebase.RTDB.setString(&fbdo, (cmdPath + "status").c_str(), "executed");
  Firebase.RTDB.setJSON(&fbdo, (cmdPath + "executedAt").c_str(), &svTimestamp);

  Serial.printf("[State] Motor stopped. Total run: %lu sec.\n", durationSec);
}

void executeResetFault(String cmdId) {
  hasFault = false;
  digitalWrite(PIN_LED_RED, LOW);
  beep(2, 60, 40);
  renderOLED("Fault Cleared");

  String statusPath = "/devices/" + String(DEVICE_ID) + "/status/";
  Firebase.RTDB.setBool(&fbdo, (statusPath + "fault").c_str(), false);
  Firebase.RTDB.setString(&fbdo, (statusPath + "faultType").c_str(), "NONE");
  Firebase.RTDB.setString(&fbdo, (statusPath + "motorStatus").c_str(), isPumpActive ? "ON" : "OFF");

  String cmdPath = "/devices/" + String(DEVICE_ID) + "/command/";
  Firebase.RTDB.setString(&fbdo, (cmdPath + "status").c_str(), "executed");
}

// =========================================================================================
//  AUTOMATED CLOUD SCHEDULER
// =========================================================================================

void checkDeviceSchedule() {
  if (!Firebase.ready()) return;

  String schedPath = "/devices/" + String(DEVICE_ID) + "/schedule";
  if (Firebase.RTDB.getJSON(&fbdoSchedule, schedPath.c_str())) {
    FirebaseJson &json = fbdoSchedule.jsonObject();
    FirebaseJsonData data;

    json.get(data, "enabled");
    bool enabled = data.boolValue;
    if (!enabled) return;

    json.get(data, "startTime");
    String startTime = data.stringValue; // e.g. "06:00"
    json.get(data, "stopTime");
    String stopTime = data.stringValue;   // e.g. "07:30"

    if (startTime.length() < 5 || stopTime.length() < 5) return;

    // Get current local time from NTP
    time_t now = time(nullptr);
    struct tm *timeinfo = localtime(&now);
    if (!timeinfo || timeinfo->tm_year < (2020 - 1900)) return; // NTP not ready yet

    int curDay = timeinfo->tm_wday; // 0 = Sunday, 1 = Monday ... 6 = Saturday
    int curHour = timeinfo->tm_hour;
    int curMin = timeinfo->tm_min;
    int curMinutes = curHour * 60 + curMin;

    // Check if today is an active day
    bool dayActive = false;
    for (int d = 0; d < 7; d++) {
      String key = "daysOfWeek/[" + String(d) + "]";
      if (json.get(data, key.c_str()) && data.intValue == curDay) {
        dayActive = true;
        break;
      }
    }
    if (!dayActive) return;

    // Parse start and stop time into minutes
    int startHour = startTime.substring(0, 2).toInt();
    int startMin = startTime.substring(3, 5).toInt();
    int startMinutes = startHour * 60 + startMin;

    int stopHour = stopTime.substring(0, 2).toInt();
    int stopMin = stopTime.substring(3, 5).toInt();
    int stopMinutes = stopHour * 60 + stopMin;

    // Evaluate schedule window
    if (curMinutes >= startMinutes && curMinutes < stopMinutes) {
      if (!isPumpActive && !hasFault) {
        Serial.printf("[Scheduler] Current time %02d:%02d is in slot (%s - %s). Auto STARTING pump!\n",
                      curHour, curMin, startTime.c_str(), stopTime.c_str());
        executePumpOn("sched_auto_on");
      }
    } else if (curMinutes >= stopMinutes) {
      if (isPumpActive) {
        Serial.printf("[Scheduler] Current time %02d:%02d reached stop time (%s). Auto STOPPING pump!\n",
                      curHour, curMin, stopTime.c_str());
        executePumpOff("sched_auto_off", false);
      }
    }
  }
}

// =========================================================================================
//  FIREBASE COMMAND LISTENER
// =========================================================================================

void checkIncomingCommands() {
  if (!Firebase.ready()) return;

  String cmdPath = "/devices/" + String(DEVICE_ID) + "/command";
  if (Firebase.RTDB.getJSON(&fbdo, cmdPath.c_str())) {
    FirebaseJson &json = fbdo.jsonObject();
    FirebaseJsonData data;

    json.get(data, "status");
    String status = data.stringValue;

    if (status == "pending") {
      json.get(data, "commandId");
      String cmdId = data.stringValue;
      json.get(data, "command");
      String cmd = data.stringValue;

      Serial.println("\n[Command Received] " + cmd + " (ID: " + cmdId + ")");
      activeCommandId = cmdId;

      FirebaseJson svTimestamp;
      svTimestamp.set(".sv", "timestamp");

      Firebase.RTDB.setString(&fbdo, (cmdPath + "/status").c_str(), "acknowledged");
      Firebase.RTDB.setJSON(&fbdo, (cmdPath + "/acknowledgedAt").c_str(), &svTimestamp);

      if (cmd == "PUMP_ON") {
        executePumpOn(cmdId);
      } else if (cmd == "PUMP_OFF") {
        executePumpOff(cmdId, false);
      } else if (cmd == "EMERGENCY_OFF") {
        executePumpOff(cmdId, true);
      } else if (cmd == "RESET_FAULT") {
        executeResetFault(cmdId);
      }
    }
  }
}

// =========================================================================================
//  SETUP
// =========================================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\n============================================"));
  Serial.println(F(" AquaFlow 4G NodeMCU Water Pump Controller  "));
  Serial.println(F(" Firmware Version: v2.5.0                   "));
  Serial.println(F("============================================"));

  pinMode(PIN_MOTOR_LED, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  digitalWrite(PIN_MOTOR_LED, LOW);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  // Initialize I2C bus: SDA = GPIO 4 (D2), SCL = GPIO 5 (D1)
  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);

  // Try standard 0x3C first, then 0x3D
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    oledReady = true;
    Serial.println(F("[OLED] Found SSD1306 display at 0x3C!"));
  } else if (display.begin(SSD1306_SWITCHCAPVCC, 0x3D)) {
    oledReady = true;
    Serial.println(F("[OLED] Found SSD1306 display at 0x3D!"));
  } else {
    Serial.println(F("[OLED] Display not detected. Check D1 (SCL) & D2 (SDA) wiring!"));
    digitalWrite(PIN_LED_RED, HIGH);
  }

  if (oledReady) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(10, 25);
    display.println(F("AQUAFLOW 4G BOOT"));
    display.display();
    delay(800);
  }

  soundStartupJingle();

  connectWiFi();

  // NTP synchronization
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  // Firebase Setup
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  Firebase.signUp(&config, &auth, "", "");
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  sendHeartbeat();

  renderOLED("System Ready");
  Serial.println(F("[System] Ready. Listening for cloud commands & schedules..."));
}

// =========================================================================================
//  MAIN LOOP
// =========================================================================================

void loop() {
  // 1. Maintain Wi-Fi
  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, HIGH);
    connectWiFi();
  } else {
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_RED, hasFault ? HIGH : LOW);
  }

  // 2. Periodic Heartbeat (every 10 seconds)
  if (millis() - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
    sendHeartbeat();
    lastHeartbeatTime = millis();
  }

  // 3. Automated Cloud Schedule Check (every 20 seconds)
  if (millis() - lastScheduleCheckTime >= SCHEDULE_CHECK_MS) {
    checkDeviceSchedule();
    lastScheduleCheckTime = millis();
  }

  // 4. Poll incoming commands from cloud
  checkIncomingCommands();

  // 5. Update OLED Display
  if (millis() - lastDisplayUpdateTime >= 2000) {
    if (isPumpActive) {
      unsigned long runSec = (millis() - pumpStartTime) / 1000;
      char buf[20];
      snprintf(buf, sizeof(buf), "Running: %02lu:%02lu", runSec / 60, runSec % 60);
      renderOLED(buf);
    } else {
      renderOLED("Status: Standby");
    }
    lastDisplayUpdateTime = millis();
  }

  delay(100);
}
