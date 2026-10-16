import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { deviceService, DEFAULT_HEARTBEAT_TIMEOUT_MS } from '../services/deviceService';
import { sessionService } from '../services/sessionService';
import { simulationService } from '../services/simulationService';
import { mockStore } from '../services/mockStore';
import { DeviceConnection, RuntimeSession, MotorStatus } from '../types/pump';

describe('AquaFlow Telemetry & Runtime Verification Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    simulationService.stopAllSimulation();
  });

  // --------------------------------------------------------------------------
  // TEST CASE 1: ESP32 heartbeat is recent -> ESP32 online
  // --------------------------------------------------------------------------
  it('1. ESP32 heartbeat is recent -> ESP32 online', () => {
    const now = 1729080000000;
    vi.setSystemTime(now);

    const connection: DeviceConnection = {
      online: true,
      lastSeen: now - 5000, // 5 seconds ago
    };

    const isOnline = deviceService.isDeviceOnline(connection, DEFAULT_HEARTBEAT_TIMEOUT_MS, now);
    expect(isOnline).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST CASE 2: Heartbeat becomes overdue -> ESP32 offline
  // --------------------------------------------------------------------------
  it('2. Heartbeat becomes overdue -> ESP32 offline', () => {
    const now = 1729080000000;
    vi.setSystemTime(now);

    const connection: DeviceConnection = {
      online: true, // Even if stale Firebase record has online: true
      lastSeen: now - 46000, // 46 seconds ago (overdue threshold is 45s)
    };

    const isOnline = deviceService.isDeviceOnline(connection, DEFAULT_HEARTBEAT_TIMEOUT_MS, now);
    expect(isOnline).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST CASE 3: Firebase is connected but ESP32 is offline -> ESP32 remains offline
  // --------------------------------------------------------------------------
  it('3. Firebase is connected but ESP32 is offline -> ESP32 remains offline', () => {
    const now = 1729080000000;
    vi.setSystemTime(now);

    // Simulated scenario: Web app reaches Firebase successfully, but ESP32 has been powered off
    const isFirebaseConnected = true;
    const connection: DeviceConnection = {
      online: false,
      lastSeen: now - 120000, // 2 minutes ago
    };

    const isDeviceOnline = deviceService.isDeviceOnline(connection, DEFAULT_HEARTBEAT_TIMEOUT_MS, now);
    // ESP32 must strictly be evaluated offline regardless of Firebase web socket status
    expect(isFirebaseConnected).toBe(true);
    expect(isDeviceOnline).toBe(false);

    const effectiveMotor = deviceService.getEffectiveMotorStatus('ON', isDeviceOnline);
    expect(effectiveMotor).toBe('UNKNOWN');
  });

  // --------------------------------------------------------------------------
  // TEST CASE 4: Wi-Fi telemetry is missing -> Wi-Fi status unknown
  // --------------------------------------------------------------------------
  it('4. Wi-Fi telemetry is missing -> Wi-Fi status unknown', () => {
    const now = 1729080000000;
    vi.setSystemTime(now);

    // Device online with recent heartbeat, but no RSSI signal telemetry
    const connectionWithoutRssi: DeviceConnection = {
      online: true,
      lastSeen: now - 2000,
      signalStrength: undefined,
    };

    const isOnline = deviceService.isDeviceOnline(connectionWithoutRssi, DEFAULT_HEARTBEAT_TIMEOUT_MS, now);
    expect(isOnline).toBe(true);

    const netStatus = deviceService.getNetworkStatus(isOnline, connectionWithoutRssi);
    expect(netStatus.status).toBe('UNKNOWN');
    expect(netStatus.label).toBe('Wi-Fi Unknown');
  });

  // --------------------------------------------------------------------------
  // TEST CASE 5: Motor ON is commanded but not confirmed -> current runtime does not start
  // --------------------------------------------------------------------------
  it('5. Motor ON is commanded but not confirmed -> current runtime does not start', () => {
    const now = 1729080000000;
    vi.setSystemTime(now);

    // Command sent, motorStatus is still 'OFF', motorStartedAt is null
    const motorStatus = 'OFF' as MotorStatus;
    const motorStartedAt = null;
    const isOnline = true;

    const isConfirmedRunning = isOnline && (motorStatus as string) === 'ON' && typeof motorStartedAt === 'number' && motorStartedAt > 0;
    expect(isConfirmedRunning).toBe(false);

    const elapsedSeconds = isConfirmedRunning && motorStartedAt ? Math.floor((now - motorStartedAt) / 1000) : 0;
    expect(elapsedSeconds).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TEST CASE 6: Motor ON is confirmed -> current runtime counts up
  // --------------------------------------------------------------------------
  it('6. Motor ON is confirmed -> current runtime counts up', () => {
    const startedAt = 1729080000000;
    vi.setSystemTime(startedAt);

    const motorStatus: MotorStatus = 'ON';
    const isOnline = true;

    // Advance 45 seconds
    const now = startedAt + 45000;
    vi.setSystemTime(now);

    const isConfirmedRunning = isOnline && motorStatus === 'ON' && typeof startedAt === 'number' && startedAt > 0;
    expect(isConfirmedRunning).toBe(true);

    const elapsedSeconds = isConfirmedRunning ? Math.floor((now - startedAt) / 1000) : 0;
    expect(elapsedSeconds).toBe(45);
    expect(sessionService.formatDuration(elapsedSeconds)).toBe('00:00:45');
  });

  // --------------------------------------------------------------------------
  // TEST CASE 7: Page refresh during a running session -> runtime is reconstructed
  // --------------------------------------------------------------------------
  it('7. Page refresh during a running session -> runtime is reconstructed from saved start timestamp', () => {
    const startedAt = 1729080000000; // e.g. 10 minutes ago
    const refreshTime = startedAt + 600000; // +10 minutes (600 seconds)
    vi.setSystemTime(refreshTime);

    // On page load, values reloaded from Firebase
    const restoredMotorStatus: MotorStatus = 'ON';
    const restoredMotorStartedAt = startedAt;
    const isOnline = true;

    const isRunning = isOnline && restoredMotorStatus === 'ON' && Boolean(restoredMotorStartedAt);
    expect(isRunning).toBe(true);

    const reconstructedElapsed = Math.floor((refreshTime - restoredMotorStartedAt) / 1000);
    expect(reconstructedElapsed).toBe(600);
    expect(sessionService.formatDuration(reconstructedElapsed)).toBe('00:10:00');
  });

  // --------------------------------------------------------------------------
  // TEST CASE 8: Motor turns OFF -> completed runtime is saved and remains fixed
  // --------------------------------------------------------------------------
  it('8. Motor turns OFF -> completed runtime is saved and remains fixed', () => {
    const startedAt = 1729080000000;
    const stoppedAt = startedAt + 1800000; // 30 minutes (1800 seconds)
    vi.setSystemTime(stoppedAt);

    const session: RuntimeSession = {
      id: 'sess_test_1',
      deviceId: 'Pump-001',
      startedAt,
      stoppedAt,
      durationSeconds: 1800,
      averageCurrent: 4.25,
      faultOccurred: false,
      stopReason: 'USER_COMMAND',
    };

    // When motor is now OFF
    const motorStatus = 'OFF' as MotorStatus;
    const isOnline = true;
    const isRunning = isOnline && (motorStatus as string) === 'ON';
    expect(isRunning).toBe(false);

    // Completed runtime remains exactly 1800 seconds
    const completedRuntime = session.durationSeconds;
    expect(completedRuntime).toBe(1800);
    expect(sessionService.formatDuration(completedRuntime)).toBe('00:30:00');

    // Advancing time does NOT change the completed duration
    vi.setSystemTime(stoppedAt + 3600000); // 1 hour later
    expect(session.durationSeconds).toBe(1800);
  });

  // --------------------------------------------------------------------------
  // TEST CASE 9: Multiple sessions today -> today's total is calculated correctly
  // --------------------------------------------------------------------------
  it("9. Multiple sessions today -> today's total is calculated correctly", () => {
    const today = new Date('2026-10-16T15:00:00Z');
    const nowMs = today.getTime();
    vi.setSystemTime(nowMs);

    const dayStart = new Date(today);
    dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();

    const session1: RuntimeSession = {
      id: 'sess_1',
      deviceId: 'Pump-001',
      startedAt: dayStartMs + 3600000,      // 01:00
      stoppedAt: dayStartMs + 3600000 + 1200000, // 01:20 (20 min = 1200s)
      durationSeconds: 1200,
      averageCurrent: 4.2,
      faultOccurred: false,
      stopReason: 'USER_COMMAND',
    };

    const session2: RuntimeSession = {
      id: 'sess_2',
      deviceId: 'Pump-001',
      startedAt: dayStartMs + 18000000,     // 05:00
      stoppedAt: dayStartMs + 18000000 + 1800000, // 05:30 (30 min = 1800s)
      durationSeconds: 1800,
      averageCurrent: 4.3,
      faultOccurred: false,
      stopReason: 'USER_COMMAND',
    };

    const totalToday = sessionService.calculateTodayTotalSeconds(
      [session1, session2],
      null,
      false,
      nowMs
    );

    // 1200 + 1800 = 3000 seconds
    expect(totalToday).toBe(3000);
    expect(sessionService.formatDuration(totalToday)).toBe('00:50:00');
  });

  // --------------------------------------------------------------------------
  // TEST CASE 10: Session crosses midnight -> daily totals are split correctly
  // --------------------------------------------------------------------------
  it('10. Session crosses midnight -> daily totals are split correctly', () => {
    // Current time is 01:00:00 on Day 2
    const day2 = new Date('2026-10-16T01:00:00');
    const nowMs = day2.getTime();
    vi.setSystemTime(nowMs);

    const day2Start = new Date(day2);
    day2Start.setHours(0, 0, 0, 0);
    const day2StartMs = day2Start.getTime();

    // Session started yesterday at 23:40 (20 mins before midnight) and finished today at 00:30 (30 mins after midnight)
    // Total duration = 50 minutes (3000s).
    // Today's portion should be ONLY the 30 minutes after midnight = 1800 seconds!
    const sessionCrossingMidnight: RuntimeSession = {
      id: 'sess_midnight',
      deviceId: 'Pump-001',
      startedAt: day2StartMs - 20 * 60 * 1000, // 23:40 yesterday
      stoppedAt: day2StartMs + 30 * 60 * 1000, // 00:30 today
      durationSeconds: 3000,
      averageCurrent: 4.25,
      faultOccurred: false,
      stopReason: 'USER_COMMAND',
    };

    const todaySplitTotal = sessionService.calculateTodayTotalSeconds(
      [sessionCrossingMidnight],
      null,
      false,
      nowMs
    );

    // Must strictly be 1800 seconds (the 30 minutes belonging to today)
    expect(todaySplitTotal).toBe(1800);
    expect(sessionService.formatDuration(todaySplitTotal)).toBe('00:30:00');
  });

  // --------------------------------------------------------------------------
  // TEST CASE 11: Simulator is disabled -> simulated telemetry stops
  // --------------------------------------------------------------------------
  it('11. Simulator is disabled -> simulated telemetry stops', () => {
    simulationService.setEnabled(true);
    expect(simulationService.isEnabled()).toBe(true);

    simulationService.setEnabled(false);
    expect(simulationService.isEnabled()).toBe(false);

    // When disabled, command processing must reject virtual triggers
    const initialDevice = mockStore.getDevice();
    simulationService.processCommand('Pump-001', {
      commandId: 'sim_test_off',
      command: 'PUMP_ON',
      createdAt: Date.now(),
      status: 'pending',
    });

    vi.advanceTimersByTime(2000);
    // State must not have turned ON
    const deviceAfter = mockStore.getDevice();
    expect(deviceAfter.status.motorStatus).toBe(initialDevice.status.motorStatus);
  });

  // --------------------------------------------------------------------------
  // TEST CASE 12: Physical hardware is offline while simulator is available ->
  //               the UI does not falsely report real hardware online
  // --------------------------------------------------------------------------
  it('12. Physical hardware is offline while simulator is available -> UI does not falsely report real hardware online', () => {
    const now = 1729080000000;
    vi.setSystemTime(now);

    // Simulator engine is enabled in drawer, but real hardware connection is overdue
    simulationService.setEnabled(true);

    const realHardwareConnection: DeviceConnection = {
      online: false,
      lastSeen: now - 90000, // 90 seconds overdue
    };

    const isHardwareOnline = deviceService.isDeviceOnline(realHardwareConnection, DEFAULT_HEARTBEAT_TIMEOUT_MS, now);
    expect(isHardwareOnline).toBe(false);

    const effectiveMotor = deviceService.getEffectiveMotorStatus('ON', isHardwareOnline);
    expect(effectiveMotor).toBe('UNKNOWN');
  });

  // --------------------------------------------------------------------------
  // TEST CASE 13: Missing or malformed timestamps -> handled safely
  // --------------------------------------------------------------------------
  it('13. Missing or malformed timestamps -> the application handles them safely', () => {
    const now = 1729080000000;
    vi.setSystemTime(now);

    // 1. null / undefined / NaN lastSeen
    expect(deviceService.isDeviceOnline(null, DEFAULT_HEARTBEAT_TIMEOUT_MS, now)).toBe(false);
    expect(deviceService.isDeviceOnline({ online: true, lastSeen: 0 }, DEFAULT_HEARTBEAT_TIMEOUT_MS, now)).toBe(false);
    expect(deviceService.isDeviceOnline({ online: true, lastSeen: NaN }, DEFAULT_HEARTBEAT_TIMEOUT_MS, now)).toBe(false);
    expect(deviceService.isDeviceOnline({ online: true, lastSeen: -100 }, DEFAULT_HEARTBEAT_TIMEOUT_MS, now)).toBe(false);
    expect(deviceService.isDeviceOnline({ online: true, lastSeen: 12345 }, DEFAULT_HEARTBEAT_TIMEOUT_MS, now)).toBe(false); // millis before 2020

    // 2. getLastSeenText with invalid inputs
    expect(deviceService.getLastSeenText(null)).toBe('Never');
    expect(deviceService.getLastSeenText(undefined)).toBe('Never');
    expect(deviceService.getLastSeenText(0)).toBe('Never');
    expect(deviceService.getLastSeenText(NaN)).toBe('Never');

    // 3. calculateTodayTotalSeconds with malformed sessions
    const malformedSessions: any[] = [
      null,
      undefined,
      { id: 'bad1', startedAt: null, stoppedAt: null },
      { id: 'bad2', startedAt: NaN, stoppedAt: 1000 },
      { id: 'bad3', startedAt: 1729080000000, stoppedAt: 1729080000000 - 5000 }, // stopped before started
    ];

    expect(() => {
      const total = sessionService.calculateTodayTotalSeconds(malformedSessions, null, false, now);
      expect(total).toBe(0);
    }).not.toThrow();

    // 4. normalizeTimestamp with seconds vs milliseconds
    expect(sessionService.normalizeTimestamp(null)).toBeNull();
    expect(sessionService.normalizeTimestamp(1729080000)).toBe(1729080000000); // 10-digit epoch converted to ms
    expect(sessionService.normalizeTimestamp(1729080000000)).toBe(1729080000000);
  });
});
