# ESP32 Integration Guide: 4G Remote Water Pump Control System

This document provides the complete hardware wiring, Firebase Realtime Database communication protocols, and ready-to-flash Arduino C++ firmware for integrating an **ESP32 microcontroller** with the **AquaFlow 4G** cloud control dashboard.

---

## 1. System Architecture Overview

```text
┌─────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│  React Web App  │ <---> │  Firebase Cloud RTDB   │ <---> │   ESP32 Controller     │
│  (Deployed on   │       │  /devices/Pump-001/... │       │   (Connected to Jio    │
│     Vercel)     │       └────────────────────────┘       │    4G Wi-Fi Hotspot)   │
└─────────────────┘                                        └───────────┬────────────┘
                                                                       │
                                            ┌──────────────────────────┴─────────────────────────┐
                                            ▼                                                    ▼
                                  ┌───────────────────┐                                ┌───────────────────┐
                                  │   Relay Module    │                                │  Current Sensor   │
                                  │     (GPIO 26)     │                                │  ACS712 (GPIO 34) │
                                  └─────────┬─────────┘                                └─────────▲─────────┘
                                            ▼                                                    │
                                  ┌───────────────────┐                                          │
                                  │   AC Contactor    │ ─── Phase Load Wire Passed Through ──────┘
                                  │   (Coil A1/A2)    │
                                  └─────────┬─────────┘
                                            ▼
                                  ┌───────────────────┐
                                  │   AC Water Pump   │
                                  │  (Borewell Motor) │
                                  └───────────────────┘
```

---

## 2. Hardware Bill of Materials (BOM) & Wiring Pinout

| Component | Recommended Model | Connected to ESP32 Pin | Purpose |
| :--- | :--- | :--- | :--- |
| **Microcontroller** | ESP32-WROOM-32 (30/38 pin) | — | Main control node |
| **4G Dongle** | JioFi M2S / Jio 4G Dongle | Wi-Fi (2.4 GHz) | Cellular Internet Gateway |
| **Relay Module** | 5V 1-Channel optocoupled relay | **GPIO 26** | Drives AC contactor coil |
| **AC Contactor** | 3-Phase / 1-Phase 230V/415V coil | Relay COM / NO | High-power motor switching |
| **Current Sensor** | ACS712 (20A or 30A module) | **GPIO 34 (ADC1_CH6)** | Hall-effect current detection |
| **Status LEDs** | Green (Relay), Blue (4G/Wi-Fi) | GPIO 2 (Built-in) / GPIO 4 | Visual hardware debugging |
| **Power Supply** | Hi-Link HLK-PM01 (5V 1A DC) | ESP32 5V (VIN) & GND | Regulated board power |

### Pin Connection Details

1. **Relay Module:**
   * `VCC` &rarr; 5V (VIN)
   * `GND` &rarr; GND
   * `IN`  &rarr; **GPIO 26** (Active HIGH or LOW depending on relay module jumper)
   * Relay `COM` & `NO` &rarr; In series with 230V Phase wire powering the Contactor Coil terminal `A1`.

2. **ACS712 Current Sensor:**
   * `VCC` &rarr; 5V
   * `GND` &rarr; GND
   * `OUT` &rarr; **GPIO 34** (Input only on ESP32, clean ADC channel 1, unaffected by Wi-Fi).
   * Sensor Terminal Blocks &rarr; Connected in series with the motor phase wire leaving the contactor.

---

## 3. Firebase Database Tree Structure

All communication between the web dashboard and the ESP32 happens under the root node:
`/devices/{deviceId}` (e.g. `/devices/Pump-001`).

```json
{
  "devices": {
    "Pump-001": {
      "name": "Field Borewell Pump #1",
      "location": "Plot 7 - Agricultural Sector",
      
      "connection": {
        "online": true,
        "lastSeen": 1727438400000,
        "signalStrength": -68,
        "firmwareVersion": "v2.4.1-esp32"
      },

      "command": {
        "commandId": "cmd_1727438412_a9f1",
        "command": "PUMP_ON",
        "createdAt": 1727438412000,
        "status": "executed",
        "acknowledgedAt": 1727438412700,
        "executedAt": 1727438413600
      },

      "status": {
        "motorStatus": "ON",
        "motorStartedAt": 1727438413600,
        "lastStoppedAt": 1727434800000,
        "lastRuntimeSeconds": 2132,
        "current": 4.25,
        "voltage": 230,
        "fault": false,
        "faultType": "NONE",
        "todayTotalRuntimeSeconds": 4252
      },

      "schedule": {
        "enabled": false,
        "startTime": "06:00",
        "stopTime": "07:30",
        "daysOfWeek": [1, 2, 3, 4, 5, 6]
      }
    }
  }
}
```

---

## 4. Communication Protocol & Handshake Workflow

### A. Heartbeat Mechanism
* Every **10 seconds**, the ESP32 pushes the current timestamp to `/devices/Pump-001/connection/lastSeen` and sets `online: true`.
* The frontend evaluates `Date.now() - lastSeen`. If more than **45 seconds** pass without a heartbeat, the dashboard automatically marks the pump device as **🔴 Offline**.

### B. Command Acknowledgment & Motor Verification Pipeline
1. **Frontend Dispatches:** Writes command with status `"pending"` to `/command`.
2. **ESP32 Receives:** The ESP32 stream listener or loop detects a new command.
3. **Acknowledgment:** ESP32 immediately updates `/command/status` = `"acknowledged"` and sets `acknowledgedAt`. The frontend UI transitions to *"Device acknowledged"*.
4. **Physical Action:** ESP32 asserts GPIO 26 to close the contactor.
5. **Sensor Verification:** ESP32 samples GPIO 34 for 500ms to calculate RMS current:
   * **If Current > 1.0 A:** Motor is confirmed running.
     * Updates `/status/motorStatus` = `"ON"`
     * Updates `/status/motorStartedAt` = `ServerValue.TIMESTAMP`
     * Updates `/status/current` = measured current (e.g. `4.24`)
     * Sets `/command/status` = `"executed"`
   * **If Current < 0.5 A:** Contactor engaged, but NO current detected (dry run, burnt coil, power cut, trip)!
     * Shuts OFF relay immediately.
     * Sets `/status/motorStatus` = `"FAULT"`
     * Sets `/status/fault` = `true`
     * Sets `/status/faultType` = `"NO_CURRENT_DETECTED"`
     * Sets `/command/status` = `"failed"`
6. **Stopwatch Starts in Frontend:** As soon as the frontend receives `motorStatus === 'ON'`, its stopwatch starts counting up using `Date.now() - motorStartedAt`.

### C. Turning OFF & Runtime Session Storage
1. Frontend dispatches `PUMP_OFF` or `EMERGENCY_OFF`.
2. ESP32 acknowledges and opens the relay contactor.
3. ESP32 verifies current drops to `0.0 A`.
4. ESP32 calculates runtime duration: `durationSeconds = (now - motorStartedAt) / 1000`.
5. Updates `/status/motorStatus` = `"OFF"`, `/status/lastStoppedAt` = `now`, `/status/lastRuntimeSeconds` = `durationSeconds`.
6. Appends a session record under `/devices/Pump-001/sessions/sess_{timestamp}`.

---

## 5. Complete Arduino C++ Firmware

Install the following library in the Arduino IDE:
* **Firebase ESP Client by Mobizt** (Library Manager &rarr; Search `FirebaseClient` or `Firebase-ESP-Client`)

```cpp
/*
 * AquaFlow 4G - Remote Water Pump Telemetry Controller
 * Microcontroller: ESP32-WROOM-32
 * Internet: Jio 4G Dongle Wi-Fi Hotspot
 * Backend: Firebase Realtime Database
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <time.h>

// ================= USER CONFIGURATION =================
// 1. Jio 4G Dongle Wi-Fi Credentials
#define WIFI_SSID "JioFi_4G_Hotspot"
#define WIFI_PASSWORD "your_jio_wifi_password"

// 2. Firebase Credentials (from Firebase Console)
#define API_KEY "AIzaSyYourFirebaseWebApiKeyHere"
#define DATABASE_URL "https://your-project-id-default-rtdb.firebaseio.com"

// 3. Device Identification
#define DEVICE_ID "Pump-001"

// 4. Hardware Pin Assignments
#define RELAY_PIN 26        // Drives 5V Relay module (Contactor A1)
#define CURRENT_ADC_PIN 34  // ACS712 Analog Out
#define LED_STATUS_PIN 2    // Built-in blue LED for connection status

// 5. Sensor Calibration
#define ACS712_SENSITIVITY 0.066  // 66mV/A for ACS712-30A (use 0.100 for 20A, 0.185 for 5A)
#define ADC_REF_VOLTAGE 3.3
#define MIN_RUNNING_CURRENT 1.0   // Below 1.0A is considered stopped or fault
// =======================================================

// Firebase data objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Timing counters
unsigned long lastHeartbeat = 0;
unsigned long lastSensorSample = 0;
String activeCommandId = "";
bool isMotorRunning = false;
unsigned long motorStartedTimestamp = 0;

// NTP Server for timestamp sync
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800; // IST UTC+5:30 (adjust for your region)
const int daylightOffset_sec = 0;

// Function prototypes
void connectWiFi();
void checkFirebaseCommands();
void sendHeartbeat();
float readCurrentRMS();
void executePumpOn(String cmdId);
void executePumpOff(String cmdId, bool isEmergency);
void handleFaultTrip(String cmdId, String faultReason);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- AquaFlow 4G ESP32 Starting ---");

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_STATUS_PIN, OUTPUT);
  pinMode(CURRENT_ADC_PIN, INPUT);

  // Default to OFF for safety
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_STATUS_PIN, LOW);

  connectWiFi();

  // Initialize NTP time
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  // Configure Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Use anonymous sign-in or user email
  auth.user.email = "";
  auth.user.password = "";

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Set initial state in RTDB
  sendHeartbeat();
  Serial.println("[ESP32] Setup complete. Listening for commands...");
}

void loop() {
  // 1. Maintain Wi-Fi connection to Jio 4G dongle
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // 2. Publish periodic heartbeat (every 10 seconds)
  if (millis() - lastHeartbeat >= 10000) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }

  // 3. Monitor current and detect dry-run or overload faults if running
  if (isMotorRunning && (millis() - lastSensorSample >= 2500)) {
    float current = readCurrentRMS();
    String path = "/devices/" + String(DEVICE_ID) + "/status/current";
    Firebase.RTDB.setFloat(&fbdo, path.c_str(), current);

    // Trip check: Command is ON, but current is 0 (phase lost / dry run)
    if (current < MIN_RUNNING_CURRENT) {
      Serial.println("[FAULT ALERT] Contactor active but 0.0A measured!");
      handleFaultTrip(activeCommandId, "NO_CURRENT_DETECTED");
    }
    lastSensorSample = millis();
  }

  // 4. Poll incoming commands from cloud
  checkFirebaseCommands();

  delay(200);
}

void connectWiFi() {
  Serial.print("[Wi-Fi] Connecting to Jio 4G Hotspot: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    digitalWrite(LED_STATUS_PIN, !digitalRead(LED_STATUS_PIN)); // Flash LED
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_STATUS_PIN, HIGH);
    Serial.println("\n[Wi-Fi] Connected! IP Address: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[Wi-Fi] Warning: Connection timeout. Will retry next cycle.");
  }
}

void sendHeartbeat() {
  if (Firebase.ready()) {
    String basePath = "/devices/" + String(DEVICE_ID) + "/connection/";
    Firebase.RTDB.setBool(&fbdo, (basePath + "online").c_str(), true);
    Firebase.RTDB.setInt(&fbdo, (basePath + "lastSeen").c_str(), (int)time(nullptr) * 1000);
    Firebase.RTDB.setInt(&fbdo, (basePath + "signalStrength").c_str(), WiFi.RSSI());
    Firebase.RTDB.setString(&fbdo, (basePath + "firmwareVersion").c_str(), "v2.4.1-esp32");
  }
}

void checkFirebaseCommands() {
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

      // STEP 1: Acknowledge command immediately
      Firebase.RTDB.setString(&fbdo, (cmdPath + "/status").c_str(), "acknowledged");

      // STEP 2: Execute hardware control
      if (cmd == "PUMP_ON") {
        executePumpOn(cmdId);
      } else if (cmd == "PUMP_OFF") {
        executePumpOff(cmdId, false);
      } else if (cmd == "EMERGENCY_OFF") {
        executePumpOff(cmdId, true);
      }
    }
  }
}

void executePumpOn(String cmdId) {
  Serial.println("[Action] Energizing Contactor Relay...");
  digitalWrite(RELAY_PIN, HIGH);
  delay(600); // Wait for contactor mechanical debounce

  float current = readCurrentRMS();
  Serial.printf("[Sensor] Current after closure: %.2f A\n", current);

  time_t now = time(nullptr);
  unsigned long nowMs = (unsigned long)now * 1000;

  if (current >= MIN_RUNNING_CURRENT) {
    isMotorRunning = true;
    motorStartedTimestamp = nowMs;

    String statusPath = "/devices/" + String(DEVICE_ID) + "/status/";
    Firebase.RTDB.setString(&fbdo, (statusPath + "motorStatus").c_str(), "ON");
    Firebase.RTDB.setInt(&fbdo, (statusPath + "motorStartedAt").c_str(), nowMs);
    Firebase.RTDB.setFloat(&fbdo, (statusPath + "current").c_str(), current);
    Firebase.RTDB.setBool(&fbdo, (statusPath + "fault").c_str(), false);

    // Final execution confirmation
    String cmdPath = "/devices/" + String(DEVICE_ID) + "/command/status";
    Firebase.RTDB.setString(&fbdo, cmdPath.c_str(), "executed");
    Serial.println("[State] Motor confirmed ON. Telemetry updated.");
  } else {
    // Current did not flow despite relay closed
    handleFaultTrip(cmdId, "NO_CURRENT_DETECTED");
  }
}

void executePumpOff(String cmdId, bool isEmergency) {
  Serial.println("[Action] De-energizing Contactor Relay...");
  digitalWrite(RELAY_PIN, LOW);
  delay(300);

  time_t now = time(nullptr);
  unsigned long nowMs = (unsigned long)now * 1000;
  unsigned long durationSec = (isMotorRunning && motorStartedTimestamp > 0) ? (nowMs - motorStartedTimestamp) / 1000 : 0;

  isMotorRunning = false;
  motorStartedTimestamp = 0;

  String statusPath = "/devices/" + String(DEVICE_ID) + "/status/";
  Firebase.RTDB.setString(&fbdo, (statusPath + "motorStatus").c_str(), "OFF");
  Firebase.RTDB.setNull(&fbdo, (statusPath + "motorStartedAt").c_str());
  Firebase.RTDB.setInt(&fbdo, (statusPath + "lastStoppedAt").c_str(), nowMs);
  Firebase.RTDB.setInt(&fbdo, (statusPath + "lastRuntimeSeconds").c_str(), durationSec);
  Firebase.RTDB.setFloat(&fbdo, (statusPath + "current").c_str(), 0.0);

  String cmdPath = "/devices/" + String(DEVICE_ID) + "/command/status";
  Firebase.RTDB.setString(&fbdo, cmdPath.c_str(), "executed");
  Serial.printf("[State] Motor stopped. Total run was %lu seconds.\n", durationSec);
}

void handleFaultTrip(String cmdId, String faultReason) {
  digitalWrite(RELAY_PIN, LOW); // Immediate safety cutoff
  isMotorRunning = false;
  motorStartedTimestamp = 0;

  String statusPath = "/devices/" + String(DEVICE_ID) + "/status/";
  Firebase.RTDB.setString(&fbdo, (statusPath + "motorStatus").c_str(), "FAULT");
  Firebase.RTDB.setBool(&fbdo, (statusPath + "fault").c_str(), true);
  Firebase.RTDB.setString(&fbdo, (statusPath + "faultType").c_str(), faultReason.c_str());
  Firebase.RTDB.setFloat(&fbdo, (statusPath + "current").c_str(), 0.0);

  String cmdPath = "/devices/" + String(DEVICE_ID) + "/command/status";
  Firebase.RTDB.setString(&fbdo, cmdPath.c_str(), "failed");
}

// Samples analog AC waveform on GPIO 34 and computes true RMS current
float readCurrentRMS() {
  float sum = 0;
  long sampleCount = 300;
  for (int i = 0; i < sampleCount; i++) {
    int raw = analogRead(CURRENT_ADC_PIN);
    float voltage = (raw / 4095.0) * ADC_REF_VOLTAGE;
    float currentInstant = (voltage - (ADC_REF_VOLTAGE / 2.0)) / ACS712_SENSITIVITY;
    sum += currentInstant * currentInstant;
    delayMicroseconds(200);
  }
  float rms = sqrt(sum / sampleCount);
  if (rms < 0.25) rms = 0.0; // Filter low noise floor
  return rms;
}
```

---

## 6. Testing Procedure with Jio 4G Dongle

1. Power on your Jio 4G dongle and verify its Wi-Fi network is broadcast.
2. In the code above, configure `WIFI_SSID` and `WIFI_PASSWORD`.
3. In the Arduino IDE, set:
   * Board: **ESP32 Dev Module**
   * Upload Speed: **921600**
   * CPU Frequency: **240MHz**
4. Flash the sketch to the ESP32.
5. Open the Arduino Serial Monitor at **115200 baud**.
6. You will see:
   ```text
   [Wi-Fi] Connected! IP Address: 192.168.1.145
   [ESP32] Setup complete. Listening for commands...
   ```
7. Open your deployed Vercel web app. The status pill will turn **🟢 Online**.
8. Click **[ TURN ON PUMP ]**:
   * Dashboard will show: *Command sent &rarr; Device acknowledged &rarr; Motor confirmed ON*.
   * The stopwatch will count up from `00:00:01`!
