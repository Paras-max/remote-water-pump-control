# AquaFlow 4G: Remote Water Pump Control System

An industrial-grade, responsive Web Application and IoT Telemetry Dashboard designed for **4G-based Remote Water Pump Control**. Built with **React**, **Vite**, **TypeScript**, **Tailwind CSS**, and backed by **Firebase Realtime Database**, ready for one-click deployment on **Vercel** and direct integration with an **ESP32 microcontroller**.

---

## 1. System Architecture

```text
  ┌────────────────────────────────────────────────────────┐
  │                 Vercel Web App (React)                 │
  │   - Realtime Stopwatch (HH:MM:SS) based on Timestamps  │
  │   - Bi-directional Command Pipeline (Ack/Executed)     │
  │   - ACS712 Current Telemetry & Dry-Run Trip Protection │
  │   - Historical Cycles & Lifetime Session Logging       │
  └───────────────────────────┬────────────────────────────┘
                              │
                              ▼ HTTPS / WSS
  ┌────────────────────────────────────────────────────────┐
  │         Firebase Realtime Database (Google Cloud)      │
  │   - Path: /devices/Pump-001/                           │
  │   - Command Queue & Heartbeat Synchronization          │
  └───────────────────────────┬────────────────────────────┘
                              │
                              ▼ Cellular Internet
  ┌────────────────────────────────────────────────────────┐
  │               Jio 4G Dongle / Wi-Fi Hotspot            │
  └───────────────────────────┬────────────────────────────┘
                              │
                              ▼ 2.4 GHz 802.11 b/g/n
  ┌────────────────────────────────────────────────────────┐
  │                ESP32 Edge Microcontroller              │
  │   - GPIO 26: 5V Relay Module -> AC Contactor Coil      │
  │   - GPIO 34: ACS712 Current Sensor (RMS Feedback)      │
  │   - Autonomous 10s Heartbeat & Fault Watchdog          │
  └────────────────────────────────────────────────────────┘
```

---

## 2. Key Features

* **True Stopwatch-Style Runtime:**
  * Displays elapsed motor run duration in **`HH : MM : SS`** format (e.g. `02 : 18 : 45`).
  * **Not a countdown timer.**
  * Anchored to `Date.now() - motorStartedAt` timestamp provided by the hardware.
  * **Zero data loss:** Page refresh, browser restarts, phone reboots, or temporary loss of phone internet **never reset the timer**.
  * Shows **Last Runtime** upon pump shutdown without losing state.
* **Strict Command Pipeline & Acknowledgment:**
  * Distinguishes between `Command: ON` vs `Motor: ON`.
  * Visual progress: *Sending command... &rarr; Command sent &rarr; Device acknowledged &rarr; Motor ON*.
  * Built-in watchdog alert: *Device not responding &mdash; Motor status unknown*.
* **Emergency Shutdown Control:**
  * Prominent, high-priority **`[ EMERGENCY OFF ]`** control button to immediately de-energize the contactor.
* **Smart Current Sensor & Fault Trip Protection:**
  * ACS712 current measurement (e.g. 4.2 A).
  * Auto-detects dry-run or contractor failure if command is ON but measured current is 0.0A.
* **10-Second Heartbeat & Offline Detection:**
  * Assesses connectivity based on actual device telemetry `lastSeen` timestamp, not merely Firebase reachability.
* **Historical Sessions & Export:**
  * Automatically records every pump cycle (Start Time, End Time, Duration, Average Current, Stop Reason, Trip status).
  * Calculates **Today's Total Runtime**.
  * One-click CSV export.
* **Integrated Hardware Simulator:**
  * Built-in interactive virtual ESP32 simulator to test commands, current draw, trips, and 4G signal loss without requiring physical hardware.
* **Flexible Dual-Mode Backend:**
  * Works out-of-the-box in **Simulation / Demo Mode** when no Firebase keys are configured.
  * Seamlessly connects to real Firebase when environment variables are supplied.

---

## 3. Technology Stack

* **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Lucide Icons.
* **Backend:** Firebase Realtime Database (RTDB), Firebase Authentication, Firestore.
* **Deployment:** Vercel.
* **Hardware:** ESP32-WROOM-32, JioFi 4G Dongle, 5V Optocoupled Relay, AC Contactor, ACS712 Current Sensor.

---

## 4. Local Development

### Prerequisites
* Node.js v18+ (tested on Node v24)
* npm v10+

### Steps
```bash
# 1. Clone repository
git clone https://github.com/your-username/water-pump-control-system.git
cd water-pump-control-system

# 2. Install dependencies
npm install

# 3. Create local environment file (optional, demo mode works without it)
cp .env.example .env

# 4. Start local development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 5. Firebase Cloud Backend Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. In the project dashboard, add a **Web App** (`</>`).
3. Copy the configuration credentials into your `.env` file or Vercel Environment Variables:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
4. **Enable Realtime Database:**
   * In the Firebase Console, go to **Build &rarr; Realtime Database** &rarr; **Create Database**.
   * Choose your preferred region and start in locked mode.
   * Go to the **Rules** tab, paste the contents of [`firebase/database.rules.json`](file:///c:/Users/PARAS/Desktop/Water%20Pump%20Control%20System/firebase/database.rules.json), and click **Publish**.
5. **Enable Firebase Authentication:**
   * Go to **Build &rarr; Authentication** &rarr; **Sign-in method**.
   * Enable **Email/Password**.

---

## 6. Vercel Deployment Instructions

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit of AquaFlow 4G"
   git branch -M main
   git remote add origin https://github.com/<your-username>/water-pump-control-system.git
   git push -u origin main
   ```
2. **Import into Vercel:**
   * Open [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New... &rarr; Project**.
   * Import your `water-pump-control-system` repository.
3. **Configure Project Settings in Vercel:**
   * **Framework Preset:** Vite
   * **Root Directory:** `./`
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
4. **Add Environment Variables:**
   * Under **Environment Variables**, paste the keys from your `.env`:
     * `VITE_FIREBASE_API_KEY`
     * `VITE_FIREBASE_AUTH_DOMAIN`
     * `VITE_FIREBASE_DATABASE_URL`
     * `VITE_FIREBASE_PROJECT_ID`
     * `VITE_FIREBASE_STORAGE_BUCKET`
     * `VITE_FIREBASE_MESSAGING_SENDER_ID`
     * `VITE_FIREBASE_APP_ID`
5. **Deploy:**
   * Click **Deploy**. Vercel will build and serve your production app globally in seconds.

---

## 7. Connecting the Physical ESP32

Refer to the complete guide: [`docs/ESP32_INTEGRATION.md`](file:///c:/Users/PARAS/Desktop/Water%20Pump%20Control%20System/docs/ESP32_INTEGRATION.md).

* **Wiring:**
  * GPIO 26 &rarr; Relay IN (Contactor Coil)
  * GPIO 34 &rarr; ACS712 OUT (Current Sensor)
  * 2.4 GHz Wi-Fi &rarr; Jio 4G Hotspot
* **Firmware:** Flash the ready-to-run C++ sketch located in `docs/ESP32_INTEGRATION.md` via the Arduino IDE using the `Firebase-ESP-Client` library.
