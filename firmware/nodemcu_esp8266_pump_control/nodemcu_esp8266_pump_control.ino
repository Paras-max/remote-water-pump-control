/*
 * =========================================================================================
 *   AquaFlow 4G - Remote Water Pump Control System
 *   LCD VERSION
 *
 *   Target Board: NodeMCU ESP8266 (ESP-12E/F) / ESP32
 *   Backend: Firebase Realtime Database
 *
 *   DISPLAY:
 *   16x2 I2C LCD
 *
 * =========================================================================================
 *
 *   HARDWARE PIN MAPPINGS:
 *
 *   - LCD SDA            -> GPIO 4  (D2 on NodeMCU)
 *   - LCD SCL            -> GPIO 5  (D1 on NodeMCU)
 *
 *   - Green LED          -> GPIO 14 (D5) -> Wi-Fi Connected
 *   - Red LED            -> GPIO 12 (D6) -> Fault / Error Alert
 *   - Buzzer             -> GPIO 13 (D7) -> Sound Feedback
 *   - Motor-indicator LED-> GPIO 16 (D0) -> Motor Active / Relay Trigger
 *   - Current Sensor A0 -> A0 -> ACS712 OUT (Optional)
 *
 * =========================================================================================
 */


// =========================================================================================
//  BOARD / WIFI
// =========================================================================================

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
#elif defined(ESP32)
  #include <WiFi.h>
#endif


// =========================================================================================
//  LCD PIN DEFINITIONS
// =========================================================================================

#define PIN_LCD_SDA       4     // D2
#define PIN_LCD_SCL       5     // D1

#define PIN_LED_GREEN     14    // D5 -> Wi-Fi Connected
#define PIN_LED_RED       12    // D6 -> Fault / Error Alert
#define PIN_BUZZER        13    // D7 -> Sound Feedback
#define PIN_MOTOR_LED     16    // D0 -> Motor Active / Relay
#define PIN_CURRENT_ADC   A0    // A0 -> ACS712 Current Sensor


// =========================================================================================
//  LIBRARIES
// =========================================================================================

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Firebase_ESP_Client.h>

#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

#include <time.h>


// =========================================================================================
//  LCD CONFIGURATION
// =========================================================================================

// Common I2C address is 0x27.
// If your LCD uses 0x3F, change 0x27 to 0x3F.

#define LCD_ADDRESS 0x27
#define LCD_COLUMNS 16
#define LCD_ROWS    2

LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLUMNS, LCD_ROWS);


// =========================================================================================
//  USER CONFIGURATION
// =========================================================================================

// KEEP YOUR EXISTING WIFI DETAILS HERE

#define WIFI_SSID       "JioFi2"
#define WIFI_PASSWORD   "652qgzz4ap"


// KEEP YOUR EXISTING FIREBASE DETAILS HERE

#define API_KEY         "AIzaSyAVdtd6tv7oZYeypamTIeLChYNAhASRk64"
#define DATABASE_URL    "https://aquaflow-remote-pump-default-rtdb.firebaseio.com"


#define DEVICE_ID       "Pump-001"


// =========================================================================================
//  CURRENT SENSOR CONFIGURATION
// =========================================================================================

// Set to true if ACS712 is actually connected to A0.
// Set to false to use the rated motor current.

#define USE_ACS712_SENSOR      false

#define RATED_MOTOR_CURRENT    4.50f

// ACS712-30A = 66mV/A
// ACS712-20A = 100mV/A

#define ACS712_SENSITIVITY     0.066f


// =========================================================================================
//  FIREBASE OBJECTS
// =========================================================================================

FirebaseData fbdo;
FirebaseData fbdoSchedule;

FirebaseAuth auth;
FirebaseConfig config;


// =========================================================================================
//  SYSTEM VARIABLES
// =========================================================================================

unsigned long lastHeartbeatTime = 0;
unsigned long lastDisplayUpdateTime = 0;
unsigned long lastScheduleCheckTime = 0;


const unsigned long HEARTBEAT_INTERVAL_MS = 10000;
const unsigned long SCHEDULE_CHECK_MS     = 20000;


bool isPumpActive = false;
bool hasFault = false;


unsigned long pumpStartTime = 0;

String activeCommandId = "";


// =========================================================================================
//  NTP / IST CONFIGURATION
// =========================================================================================

const char* ntpServer = "pool.ntp.org";

const long gmtOffset_sec = 19800;

const int daylightOffset_sec = 0;


// =========================================================================================
//  LCD HELPER FUNCTIONS
// =========================================================================================

void clearLCDLine(int row) {

  lcd.setCursor(0, row);

  lcd.print("                ");

}


// =========================================================================================
//  DISPLAY SYSTEM STATUS
// =========================================================================================

void renderLCD(const char* statusText) {

  lcd.clear();

  // ---------------------------------------------------------
  // LINE 1
  // ---------------------------------------------------------

  lcd.setCursor(0, 0);

  if (hasFault) {

    lcd.print("PUMP: FAULT");

  }

  else if (isPumpActive) {

    lcd.print("PUMP: RUNNING");

  }

  else {

    lcd.print("PUMP: STOPPED");

  }


  // ---------------------------------------------------------
  // LINE 2
  // ---------------------------------------------------------

  lcd.setCursor(0, 1);

  lcd.print(statusText);


}


// =========================================================================================
//  MORE DETAILED LCD STATUS
// =========================================================================================

void renderSystemStatus() {

  lcd.clear();


  // ---------------------------------------------------------
  // PUMP STATUS
  // ---------------------------------------------------------

  lcd.setCursor(0, 0);

  if (hasFault) {

    lcd.print("FAULT");

  }

  else if (isPumpActive) {

    lcd.print("PUMP: ON");

  }

  else {

    lcd.print("PUMP: OFF");

  }


  // ---------------------------------------------------------
  // WIFI STATUS
  // ---------------------------------------------------------

  lcd.setCursor(9, 0);

  if (WiFi.status() == WL_CONNECTED) {

    lcd.print("WiFi:OK");

  }

  else {

    lcd.print("WiFi:--");

  }


  // ---------------------------------------------------------
  // SECOND LINE
  // ---------------------------------------------------------

  lcd.setCursor(0, 1);

  if (isPumpActive) {

    unsigned long runSec =
      (millis() - pumpStartTime) / 1000;

    unsigned long minutes = runSec / 60;
    unsigned long seconds = runSec % 60;


    lcd.print("TIME ");

    if (minutes < 10)
      lcd.print("0");

    lcd.print(minutes);

    lcd.print(":");


    if (seconds < 10)
      lcd.print("0");

    lcd.print(seconds);

  }

  else {

    lcd.print("SYSTEM READY");

  }

}


// =========================================================================================
//  BUZZER
// =========================================================================================

void beep(
  int count,
  int durationMs = 100,
  int pauseMs = 80
) {

  for (int i = 0; i < count; i++) {

    digitalWrite(PIN_BUZZER, HIGH);

    delay(durationMs);

    digitalWrite(PIN_BUZZER, LOW);

    if (i < count - 1) {

      delay(pauseMs);

    }

  }

}


// =========================================================================================
//  STARTUP SOUND
// =========================================================================================

void soundStartupJingle() {

  beep(1, 80, 50);

  beep(1, 120, 0);

}


// =========================================================================================
//  ALARM SOUND
// =========================================================================================

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
//  MOTOR CURRENT MEASUREMENT
// =========================================================================================

float measureMotorCurrent() {

  // Pump OFF = 0A

  if (!isPumpActive) {

    return 0.0f;

  }


  // ---------------------------------------------------------
  // SIMULATED / RATED CURRENT
  // ---------------------------------------------------------

  if (!USE_ACS712_SENSOR) {

    float fluctuation =
      ((float)(random(0, 9) - 4)) / 100.0f;

    return RATED_MOTOR_CURRENT + fluctuation;

  }


  // ---------------------------------------------------------
  // ACS712 MEASUREMENT
  // ---------------------------------------------------------

  long sum = 0;

  long sampleCount = 150;


  for (int i = 0; i < sampleCount; i++) {

    int raw = analogRead(PIN_CURRENT_ADC);

    int centered = raw - 512;

    sum += (long)centered * centered;

    delayMicroseconds(200);

  }


  float mean =
    (float)sum / (float)sampleCount;


  float rmsRaw =
    sqrt(mean);


  float rmsVoltage =
    rmsRaw * (3.3f / 1024.0f);


  float rmsAmps =
    rmsVoltage / ACS712_SENSITIVITY;


  if (rmsAmps < 0.25f) {

    rmsAmps = 0.0f;

  }


  return rmsAmps;

}


// =========================================================================================
//  WIFI CONNECTION
// =========================================================================================

void connectWiFi() {

  Serial.print(F("[WiFi] Connecting to: "));

  Serial.println(WIFI_SSID);


  lcd.clear();

  lcd.setCursor(0, 0);

  lcd.print("Connecting WiFi");


  lcd.setCursor(0, 1);

  lcd.print("Please wait...");


  WiFi.mode(WIFI_STA);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);


  int attempts = 0;


  while (
    WiFi.status() != WL_CONNECTED &&
    attempts < 35
  ) {

    delay(400);


    digitalWrite(
      PIN_LED_GREEN,
      !digitalRead(PIN_LED_GREEN)
    );


    Serial.print(F("."));

    attempts++;

  }


  // ---------------------------------------------------------
  // WIFI CONNECTED
  // ---------------------------------------------------------

  if (WiFi.status() == WL_CONNECTED) {

    digitalWrite(PIN_LED_GREEN, HIGH);

    digitalWrite(PIN_LED_RED, LOW);


    Serial.println(F(
      "\n[WiFi] Connected successfully!"
    ));


    Serial.print(F("[WiFi] IP: "));

    Serial.println(WiFi.localIP());


    lcd.clear();

    lcd.setCursor(0, 0);

    lcd.print("WiFi Connected");


    lcd.setCursor(0, 1);

    lcd.print("IP:");

    lcd.print(WiFi.localIP());


    delay(1500);


    beep(2, 80, 50);

  }


  // ---------------------------------------------------------
  // WIFI FAILED
  // ---------------------------------------------------------

  else {

    digitalWrite(PIN_LED_GREEN, LOW);

    digitalWrite(PIN_LED_RED, HIGH);


    Serial.println(
      F("\n[WiFi] Connection timeout. Retrying...")
    );


    lcd.clear();

    lcd.setCursor(0, 0);

    lcd.print("WiFi Failed!");


    lcd.setCursor(0, 1);

    lcd.print("Retrying...");

  }

}


// =========================================================================================
//  FIREBASE HEARTBEAT
// =========================================================================================

void sendHeartbeat() {

  if (!Firebase.ready()) {

    return;

  }


  String basePath =
    "/devices/" +
    String(DEVICE_ID) +
    "/connection/";


  // ---------------------------------------------------------
  // ONLINE
  // ---------------------------------------------------------

  Firebase.RTDB.setBool(
    &fbdo,
    (basePath + "online").c_str(),
    true
  );


  // ---------------------------------------------------------
  // SERVER TIMESTAMP
  // ---------------------------------------------------------

  FirebaseJson svTimestamp;

  svTimestamp.set(
    ".sv",
    "timestamp"
  );


  Firebase.RTDB.setJSON(
    &fbdo,
    (basePath + "lastSeen").c_str(),
    &svTimestamp
  );


  // ---------------------------------------------------------
  // WIFI SIGNAL
  // ---------------------------------------------------------

  Firebase.RTDB.setInt(
    &fbdo,
    (basePath + "signalStrength").c_str(),
    WiFi.RSSI()
  );


  // ---------------------------------------------------------
  // IP ADDRESS
  // ---------------------------------------------------------

  Firebase.RTDB.setString(
    &fbdo,
    (basePath + "ipAddress").c_str(),
    WiFi.localIP().toString().c_str()
  );


  // ---------------------------------------------------------
  // FIRMWARE VERSION
  // ---------------------------------------------------------

  Firebase.RTDB.setString(
    &fbdo,
    (basePath + "firmwareVersion").c_str(),
    "v2.5.0-lcd"
  );


  // ---------------------------------------------------------
  // CURRENT
  // ---------------------------------------------------------

  float currentAmps =
    measureMotorCurrent();


  String currentPath =
    "/devices/" +
    String(DEVICE_ID) +
    "/status/current";


  Firebase.RTDB.setFloat(
    &fbdo,
    currentPath.c_str(),
    currentAmps
  );

}


// =========================================================================================
//  PUMP ON
// =========================================================================================

void executePumpOn(String cmdId) {

  Serial.println(
    F("[Action] Starting Pump Motor...")
  );


  digitalWrite(
    PIN_MOTOR_LED,
    HIGH
  );


  isPumpActive = true;

  hasFault = false;

  pumpStartTime = millis();


  beep(1, 200);


  lcd.clear();

  lcd.setCursor(0, 0);

  lcd.print("PUMP STARTED");


  lcd.setCursor(0, 1);

  lcd.print("Motor: ON");


  delay(800);


  // ---------------------------------------------------------
  // CURRENT
  // ---------------------------------------------------------

  float currentVal =
    measureMotorCurrent();


  // ---------------------------------------------------------
  // FIREBASE STATUS
  // ---------------------------------------------------------

  String statusPath =
    "/devices/" +
    String(DEVICE_ID) +
    "/status/";


  Firebase.RTDB.setString(
    &fbdo,
    (statusPath + "motorStatus").c_str(),
    "ON"
  );


  // ---------------------------------------------------------
  // MOTOR START TIMESTAMP
  // ---------------------------------------------------------

  FirebaseJson svTimestamp;

  svTimestamp.set(
    ".sv",
    "timestamp"
  );


  Firebase.RTDB.setJSON(
    &fbdo,
    (statusPath + "motorStartedAt").c_str(),
    &svTimestamp
  );


  // ---------------------------------------------------------
  // CURRENT
  // ---------------------------------------------------------

  Firebase.RTDB.setFloat(
    &fbdo,
    (statusPath + "current").c_str(),
    currentVal
  );


  // ---------------------------------------------------------
  // FAULT
  // ---------------------------------------------------------

  Firebase.RTDB.setBool(
    &fbdo,
    (statusPath + "fault").c_str(),
    false
  );


  Firebase.RTDB.setString(
    &fbdo,
    (statusPath + "faultType").c_str(),
    "NONE"
  );


  // ---------------------------------------------------------
  // COMMAND STATUS
  // ---------------------------------------------------------

  String cmdPath =
    "/devices/" +
    String(DEVICE_ID) +
    "/command/";


  Firebase.RTDB.setString(
    &fbdo,
    (cmdPath + "status").c_str(),
    "executed"
  );


  Firebase.RTDB.setJSON(
    &fbdo,
    (cmdPath + "executedAt").c_str(),
    &svTimestamp
  );


  Serial.println(
    F("[State] Motor is ON. Telemetry and server timestamp updated.")
  );

}


// =========================================================================================
//  PUMP OFF
// =========================================================================================

void executePumpOff(
  String cmdId,
  bool isEmergency
) {

  Serial.println(
    isEmergency
      ? F("[Action] EMERGENCY STOP!")
      : F("[Action] Stopping Pump Motor...")
  );


  digitalWrite(
    PIN_MOTOR_LED,
    LOW
  );


  isPumpActive = false;


  // ---------------------------------------------------------
  // ALARM
  // ---------------------------------------------------------

  if (isEmergency) {

    soundAlarm();

  }

  else {

    beep(2, 100, 70);

  }


  // ---------------------------------------------------------
  // CALCULATE RUNTIME
  // ---------------------------------------------------------

  unsigned long durationSec =
    (pumpStartTime > 0)
      ? ((millis() - pumpStartTime) / 1000)
      : 0;


  pumpStartTime = 0;


  // ---------------------------------------------------------
  // LCD
  // ---------------------------------------------------------

  lcd.clear();


  if (isEmergency) {

    lcd.setCursor(0, 0);

    lcd.print("EMERGENCY STOP");

    lcd.setCursor(0, 1);

    lcd.print("Pump OFF");

  }

  else {

    lcd.setCursor(0, 0);

    lcd.print("PUMP STOPPED");

    lcd.setCursor(0, 1);

    lcd.print("Time:");

    lcd.print(durationSec);

    lcd.print(" sec");

  }


  delay(1000);


  // ---------------------------------------------------------
  // FIREBASE
  // ---------------------------------------------------------

  FirebaseJson svTimestamp;

  svTimestamp.set(
    ".sv",
    "timestamp"
  );


  String statusPath =
    "/devices/" +
    String(DEVICE_ID) +
    "/status/";


  Firebase.RTDB.setString(
    &fbdo,
    (statusPath + "motorStatus").c_str(),
    "OFF"
  );


  Firebase.RTDB.setInt(
    &fbdo,
    (statusPath + "motorStartedAt").c_str(),
    0
  );


  Firebase.RTDB.setJSON(
    &fbdo,
    (statusPath + "lastStoppedAt").c_str(),
    &svTimestamp
  );


  Firebase.RTDB.setInt(
    &fbdo,
    (statusPath + "lastRuntimeSeconds").c_str(),
    (int)durationSec
  );


  Firebase.RTDB.setFloat(
    &fbdo,
    (statusPath + "current").c_str(),
    0.0
  );


  // ---------------------------------------------------------
  // COMMAND
  // ---------------------------------------------------------

  String cmdPath =
    "/devices/" +
    String(DEVICE_ID) +
    "/command/";


  Firebase.RTDB.setString(
    &fbdo,
    (cmdPath + "status").c_str(),
    "executed"
  );


  Firebase.RTDB.setJSON(
    &fbdo,
    (cmdPath + "executedAt").c_str(),
    &svTimestamp
  );

  // ---------------------------------------------------------
  // RECORD COMPLETED SESSION TO FIREBASE /sessions
  // ---------------------------------------------------------
  if (durationSec > 0) {
    time_t curEpoch = time(nullptr);
    String sessId = "sess_" + String((unsigned long)curEpoch) + "_" + String(random(100, 999));
    String sessPath = "/devices/" + String(DEVICE_ID) + "/sessions/" + sessId;

    FirebaseJson sessJson;
    sessJson.set("id", sessId);
    sessJson.set("deviceId", String(DEVICE_ID));
    if (curEpoch > 1577836800) {
      sessJson.set("startedAt", (double)(curEpoch - durationSec) * 1000.0);
      sessJson.set("stoppedAt", (double)curEpoch * 1000.0);
    } else {
      sessJson.set("startedAt", (double)millis());
      sessJson.set("stoppedAt", (double)millis());
    }
    sessJson.set("durationSeconds", (int)durationSec);
    sessJson.set("averageCurrent", 4.30);
    sessJson.set("faultOccurred", hasFault);
    sessJson.set("stopReason", isEmergency ? "EMERGENCY_OFF" : (hasFault ? "FAULT_TRIP" : "USER_COMMAND"));

    Firebase.RTDB.setJSON(&fbdo, sessPath.c_str(), &sessJson);
  }

  Serial.printf(
    "[State] Motor stopped. Total run: %lu sec.\n",
    durationSec
  );
}


// =========================================================================================
//  RESET FAULT
// =========================================================================================

void executeResetFault(String cmdId) {

  hasFault = false;


  digitalWrite(
    PIN_LED_RED,
    LOW
  );


  beep(2, 60, 40);


  lcd.clear();

  lcd.setCursor(0, 0);

  lcd.print("FAULT CLEARED");


  lcd.setCursor(0, 1);

  if (isPumpActive) {

    lcd.print("Pump: ON");

  }

  else {

    lcd.print("Pump: OFF");

  }


  delay(800);


  // ---------------------------------------------------------
  // FIREBASE
  // ---------------------------------------------------------

  String statusPath =
    "/devices/" +
    String(DEVICE_ID) +
    "/status/";


  Firebase.RTDB.setBool(
    &fbdo,
    (statusPath + "fault").c_str(),
    false
  );


  Firebase.RTDB.setString(
    &fbdo,
    (statusPath + "faultType").c_str(),
    "NONE"
  );


  Firebase.RTDB.setString(
    &fbdo,
    (statusPath + "motorStatus").c_str(),
    isPumpActive ? "ON" : "OFF"
  );


  String cmdPath =
    "/devices/" +
    String(DEVICE_ID) +
    "/command/";


  Firebase.RTDB.setString(
    &fbdo,
    (cmdPath + "status").c_str(),
    "executed"
  );

}


// =========================================================================================
//  CHECK DEVICE SCHEDULE
// =========================================================================================

void checkDeviceSchedule() {

  if (!Firebase.ready()) {

    return;

  }


  String schedPath =
    "/devices/" +
    String(DEVICE_ID) +
    "/schedule";


  if (
    Firebase.RTDB.getJSON(
      &fbdoSchedule,
      schedPath.c_str()
    )
  ) {

    FirebaseJson &json =
      fbdoSchedule.jsonObject();


    FirebaseJsonData data;


    // -------------------------------------------------------
    // ENABLED
    // -------------------------------------------------------

    json.get(
      data,
      "enabled"
    );


    bool enabled =
      data.boolValue;


    if (!enabled) {

      return;

    }


    // -------------------------------------------------------
    // START TIME
    // -------------------------------------------------------

    json.get(
      data,
      "startTime"
    );


    String startTime =
      data.stringValue;


    // -------------------------------------------------------
    // STOP TIME
    // -------------------------------------------------------

    json.get(
      data,
      "stopTime"
    );


    String stopTime =
      data.stringValue;


    if (
      startTime.length() < 5 ||
      stopTime.length() < 5
    ) {

      return;

    }


    // -------------------------------------------------------
    // CURRENT TIME
    // -------------------------------------------------------

    time_t now =
      time(nullptr);


    struct tm *timeinfo =
      localtime(&now);


    if (
      !timeinfo ||
      timeinfo->tm_year < (2020 - 1900)
    ) {

      return;

    }


    int curDay =
      timeinfo->tm_wday;


    int curHour =
      timeinfo->tm_hour;


    int curMin =
      timeinfo->tm_min;


    int curMinutes =
      curHour * 60 + curMin;


    // -------------------------------------------------------
    // DAY CHECK
    // -------------------------------------------------------

    bool dayActive = false;


    for (int d = 0; d < 7; d++) {

      String key =
        "daysOfWeek/[" +
        String(d) +
        "]";


      if (
        json.get(
          data,
          key.c_str()
        ) &&
        data.intValue == curDay
      ) {

        dayActive = true;

        break;

      }

    }


    if (!dayActive) {

      return;

    }


    // -------------------------------------------------------
    // START TIME
    // -------------------------------------------------------

    int startHour =
      startTime.substring(0, 2).toInt();


    int startMin =
      startTime.substring(3, 5).toInt();


    int startMinutes =
      startHour * 60 + startMin;


    // -------------------------------------------------------
    // STOP TIME
    // -------------------------------------------------------

    int stopHour =
      stopTime.substring(0, 2).toInt();


    int stopMin =
      stopTime.substring(3, 5).toInt();


    int stopMinutes =
      stopHour * 60 + stopMin;


    // -------------------------------------------------------
    // SCHEDULE ACTIVE
    // -------------------------------------------------------

    if (
      curMinutes >= startMinutes &&
      curMinutes < stopMinutes
    ) {

      if (
        !isPumpActive &&
        !hasFault
      ) {

        Serial.printf(
          "[Scheduler] Current time %02d:%02d in slot (%s - %s). Auto STARTING pump!\n",
          curHour,
          curMin,
          startTime.c_str(),
          stopTime.c_str()
        );


        executePumpOn(
          "sched_auto_on"
        );

      }

    }


    // -------------------------------------------------------
    // SCHEDULE STOP
    // -------------------------------------------------------

    else if (
      curMinutes >= stopMinutes
    ) {

      if (isPumpActive) {

        Serial.printf(
          "[Scheduler] Current time %02d:%02d reached stop time (%s). Auto STOPPING pump!\n",
          curHour,
          curMin,
          stopTime.c_str()
        );


        executePumpOff(
          "sched_auto_off",
          false
        );

      }

    }

  }

}


// =========================================================================================
//  CHECK INCOMING FIREBASE COMMANDS
// =========================================================================================

void checkIncomingCommands() {

  if (!Firebase.ready()) {

    return;

  }


  String cmdPath =
    "/devices/" +
    String(DEVICE_ID) +
    "/command";


  if (
    Firebase.RTDB.getJSON(
      &fbdo,
      cmdPath.c_str()
    )
  ) {

    FirebaseJson &json =
      fbdo.jsonObject();


    FirebaseJsonData data;


    // -------------------------------------------------------
    // COMMAND STATUS
    // -------------------------------------------------------

    json.get(
      data,
      "status"
    );


    String status =
      data.stringValue;


    // -------------------------------------------------------
    // PENDING COMMAND
    // -------------------------------------------------------

    if (status == "pending") {

      // -----------------------------------------------------
      // COMMAND ID
      // -----------------------------------------------------

      json.get(
        data,
        "commandId"
      );


      String cmdId =
        data.stringValue;


      // -----------------------------------------------------
      // COMMAND
      // -----------------------------------------------------

      json.get(
        data,
        "command"
      );


      String cmd =
        data.stringValue;


      Serial.println(
        "\n[Command Received] " +
        cmd +
        " (ID: " +
        cmdId +
        ")"
      );

      // Safety check: Ignore stale PUMP_ON commands older than 60 seconds
      json.get(data, "createdAt");
      double createdAtMs = data.doubleValue;
      time_t curEpoch = time(nullptr);
      if (curEpoch > 1577836800 && createdAtMs > 1577836800000.0) {
        double ageSec = ((double)curEpoch * 1000.0 - createdAtMs) / 1000.0;
        if (ageSec > 60.0 && cmd == "PUMP_ON") {
          Serial.printf("[Safety Alert] Discarded stale PUMP_ON command from offline queue (Age: %.0fs)\n", ageSec);
          Firebase.RTDB.setString(&fbdo, (cmdPath + "/status").c_str(), "timeout");
          Firebase.RTDB.setString(&fbdo, (cmdPath + "/errorMessage").c_str(), "Safety: Command expired while ESP32 was offline");
          return;
        }
      }

      activeCommandId =
        cmdId;


      // -----------------------------------------------------
      // TIMESTAMP
      // -----------------------------------------------------

      FirebaseJson svTimestamp;

      svTimestamp.set(
        ".sv",
        "timestamp"
      );


      // -----------------------------------------------------
      // ACKNOWLEDGE
      // -----------------------------------------------------

      Firebase.RTDB.setString(
        &fbdo,
        (cmdPath + "/status").c_str(),
        "acknowledged"
      );


      Firebase.RTDB.setJSON(
        &fbdo,
        (cmdPath + "/acknowledgedAt").c_str(),
        &svTimestamp
      );


      // -----------------------------------------------------
      // COMMAND ACTION
      // -----------------------------------------------------

      if (cmd == "PUMP_ON") {

        executePumpOn(
          cmdId
        );

      }


      else if (cmd == "PUMP_OFF") {

        executePumpOff(
          cmdId,
          false
        );

      }


      else if (cmd == "EMERGENCY_OFF") {

        executePumpOff(
          cmdId,
          true
        );

      }


      else if (cmd == "RESET_FAULT") {

        executeResetFault(
          cmdId
        );

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


  Serial.println(
    F("\n============================================")
  );


  Serial.println(
    F(" AquaFlow 4G NodeMCU Water Pump Controller ")
  );


  Serial.println(
    F(" LCD VERSION                              ")
  );


  Serial.println(
    F(" Firmware Version: v2.5.0                 ")
  );


  Serial.println(
    F("============================================")
  );


  // =======================================================================================
  //  GPIO INITIALIZATION
  // =======================================================================================

  pinMode(
    PIN_MOTOR_LED,
    OUTPUT
  );


  pinMode(
    PIN_LED_GREEN,
    OUTPUT
  );


  pinMode(
    PIN_LED_RED,
    OUTPUT
  );


  pinMode(
    PIN_BUZZER,
    OUTPUT
  );


  // =======================================================================================
  //  INITIAL OUTPUT STATES
  // =======================================================================================

  digitalWrite(
    PIN_MOTOR_LED,
    LOW
  );


  digitalWrite(
    PIN_LED_GREEN,
    LOW
  );


  digitalWrite(
    PIN_LED_RED,
    LOW
  );


  digitalWrite(
    PIN_BUZZER,
    LOW
  );


  // =======================================================================================
  //  LCD INITIALIZATION
  // =======================================================================================

  Wire.begin(
    PIN_LCD_SDA,
    PIN_LCD_SCL
  );


  lcd.init();

  lcd.backlight();


  lcd.clear();


  lcd.setCursor(0, 0);

  lcd.print("AQUAFLOW 4G");


  lcd.setCursor(0, 1);

  lcd.print("System Booting");


  delay(1500);


  // =======================================================================================
  //  STARTUP SOUND
  // =======================================================================================

  soundStartupJingle();


  // =======================================================================================
  //  WIFI
  // =======================================================================================

  connectWiFi();


  // =======================================================================================
  //  NTP
  // =======================================================================================

  configTime(
    gmtOffset_sec,
    daylightOffset_sec,
    ntpServer
  );


  // =======================================================================================
  //  FIREBASE CONFIGURATION
  // =======================================================================================

  config.api_key =
    API_KEY;


  config.database_url =
    DATABASE_URL;


  // =======================================================================================
  //  FIREBASE AUTHENTICATION
  // =======================================================================================

  Firebase.signUp(
    &config,
    &auth,
    "",
    ""
  );


  Firebase.begin(
    &config,
    &auth
  );


  Firebase.reconnectWiFi(
    true
  );


  // =======================================================================================
  //  INITIAL HEARTBEAT
  // =======================================================================================

  sendHeartbeat();


  // =======================================================================================
  //  READY
  // =======================================================================================

  lcd.clear();


  lcd.setCursor(0, 0);

  lcd.print("AQUAFLOW READY");


  lcd.setCursor(0, 1);

  lcd.print("Pump: OFF");


  Serial.println(
    F("[System] Ready. Listening for cloud commands & schedules...")
  );

}


// =========================================================================================
//  MAIN LOOP
// =========================================================================================

void loop() {


  // =======================================================================================
  //  WIFI MONITOR
  // =======================================================================================

  if (
    WiFi.status() != WL_CONNECTED
  ) {

    digitalWrite(
      PIN_LED_GREEN,
      LOW
    );


    digitalWrite(
      PIN_LED_RED,
      HIGH
    );


    connectWiFi();

  }


  else {

    digitalWrite(
      PIN_LED_GREEN,
      HIGH
    );


    digitalWrite(
      PIN_LED_RED,
      hasFault ? HIGH : LOW
    );

  }


  // =======================================================================================
  //  HEARTBEAT
  // =======================================================================================

  if (
    millis() - lastHeartbeatTime >=
    HEARTBEAT_INTERVAL_MS
  ) {

    sendHeartbeat();


    lastHeartbeatTime =
      millis();

  }


  // =======================================================================================
  //  SCHEDULE CHECK
  // =======================================================================================

  if (
    millis() - lastScheduleCheckTime >=
    SCHEDULE_CHECK_MS
  ) {

    checkDeviceSchedule();


    lastScheduleCheckTime =
      millis();

  }


  // =======================================================================================
  //  FIREBASE COMMANDS
  // =======================================================================================

  checkIncomingCommands();


  // =======================================================================================
  //  LCD UPDATE
  // =======================================================================================

  if (
    millis() - lastDisplayUpdateTime >=
    2000
  ) {

    renderSystemStatus();


    lastDisplayUpdateTime =
      millis();

  }


  // =======================================================================================
  //  SMALL LOOP DELAY
  // =======================================================================================

  delay(100);

}