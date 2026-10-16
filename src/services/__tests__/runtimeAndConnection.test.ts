import { describe, it, expect } from 'vitest';
import { deviceService } from '../deviceService';
import { sessionService } from '../sessionService';
import { RuntimeSession } from '../../types/pump';

describe('AquaFlow 4G: Device Connection & Heartbeat Detection', () => {
  it('considers device ONLINE when lastSeen is within 45s threshold', () => {
    const now = Date.now();
    const online = deviceService.isDeviceOnline(
      { online: true, lastSeen: now - 10000, signalStrength: -65 },
      45000,
      now
    );
    expect(online).toBe(true);
  });

  it('considers device OFFLINE when heartbeat timestamp is older than threshold', () => {
    const now = Date.now();
    const online = deviceService.isDeviceOnline(
      { online: true, lastSeen: now - 50000, signalStrength: -65 },
      45000,
      now
    );
    expect(online).toBe(false);
  });

  it('handles seconds-format timestamps correctly', () => {
    const nowMs = 1700000000000;
    const lastSeenSec = 1700000000 - 20; // 20s ago
    const online = deviceService.isDeviceOnline(
      { online: true, lastSeen: lastSeenSec },
      45000,
      nowMs
    );
    expect(online).toBe(true);
  });

  it('rejects missing, 0, or pre-2020 timestamps as offline', () => {
    expect(deviceService.isDeviceOnline(null)).toBe(false);
    expect(deviceService.isDeviceOnline({ online: true, lastSeen: 0 })).toBe(false);
    expect(deviceService.isDeviceOnline({ online: true, lastSeen: 12345 })).toBe(false); // early millis
  });

  it('marks motor status as UNKNOWN if device is offline even if reported status was ON', () => {
    expect(deviceService.getEffectiveMotorStatus('ON', false)).toBe('UNKNOWN');
    expect(deviceService.getEffectiveMotorStatus('ON', true)).toBe('ON');
    expect(deviceService.getEffectiveMotorStatus('OFF', true)).toBe('OFF');
  });
});

describe('AquaFlow 4G: Session & Runtime Calculation', () => {
  it('formats duration into HH:MM:SS format correctly', () => {
    expect(sessionService.formatDuration(0)).toBe('00:00:00');
    expect(sessionService.formatDuration(65)).toBe('00:01:05');
    expect(sessionService.formatDuration(3665)).toBe('01:01:05');
  });

  it('calculates today total runtime from completed sessions', () => {
    const today = new Date();
    today.setHours(10, 0, 0, 0);
    const start1 = today.getTime();
    const end1 = start1 + 1800 * 1000; // 30 mins

    const sessions: RuntimeSession[] = [
      {
        id: 'sess-1',
        deviceId: 'Pump-001',
        startedAt: start1,
        stoppedAt: end1,
        durationSeconds: 1800,
        averageCurrent: 4.2,
        faultOccurred: false,
        stopReason: 'USER_COMMAND',
      },
    ];

    const total = sessionService.calculateTodayTotalSeconds(sessions, null, false, today.getTime() + 3600 * 1000);
    expect(total).toBe(1800);
  });

  it('correctly handles sessions crossing midnight boundaries', () => {
    const testDate = new Date('2026-10-16T12:00:00Z');
    const dayStart = new Date(testDate);
    dayStart.setHours(0, 0, 0, 0);

    // Session started 1 hour before midnight and ran 1 hour after midnight
    const startedAt = dayStart.getTime() - 3600 * 1000;
    const stoppedAt = dayStart.getTime() + 3600 * 1000;

    const sessions: RuntimeSession[] = [
      {
        id: 'cross-midnight',
        deviceId: 'Pump-001',
        startedAt,
        stoppedAt,
        durationSeconds: 7200,
        averageCurrent: 4.2,
        faultOccurred: false,
        stopReason: 'USER_COMMAND',
      },
    ];

    // Only the 1 hour (3600s) inside today should count
    const total = sessionService.calculateTodayTotalSeconds(sessions, null, false, testDate.getTime());
    expect(total).toBe(3600);
  });

  it('includes active session elapsed time only when confirmed running', () => {
    const now = Date.now();
    const activeStart = now - 600 * 1000; // 10 minutes ago

    // When NOT confirmed running
    const totalInactive = sessionService.calculateTodayTotalSeconds([], activeStart, false, now);
    expect(totalInactive).toBe(0);

    // When confirmed running
    const totalActive = sessionService.calculateTodayTotalSeconds([], activeStart, true, now);
    expect(totalActive).toBe(600);
  });
});
