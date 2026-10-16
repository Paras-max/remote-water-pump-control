import { DeviceConnection, DeviceSchedule, MotorStatus } from '../types/pump';
import { isFirebaseConfigured, rtdb } from './firebase';
import { ref, update } from 'firebase/database';
import { mockStore } from './mockStore';

// Default maximum threshold before considering device offline (45 seconds)
export const DEFAULT_HEARTBEAT_TIMEOUT_MS = 45000;
export const HEARTBEAT_TIMEOUT_MS = DEFAULT_HEARTBEAT_TIMEOUT_MS;

export class DeviceService {
  private heartbeatTimeoutMs: number = DEFAULT_HEARTBEAT_TIMEOUT_MS;

  /**
   * Allows setting a custom heartbeat timeout for testing or specific field environments.
   */
  setHeartbeatTimeoutMs(timeoutMs: number) {
    this.heartbeatTimeoutMs = timeoutMs;
  }

  getHeartbeatTimeoutMs(): number {
    return this.heartbeatTimeoutMs;
  }

  /**
   * Evaluates if a device is genuinely online based on its latest heartbeat timestamp.
   * Do NOT assume online merely because Firebase is connected or command succeeded!
   * Stale data older than timeout is strictly considered OFFLINE.
   */
  isDeviceOnline(
    connection?: DeviceConnection | null,
    timeoutMs: number = this.heartbeatTimeoutMs,
    nowMs: number = Date.now()
  ): boolean {
    if (!connection || connection.lastSeen === undefined || connection.lastSeen === null) {
      return false;
    }

    let lastSeenMs = Number(connection.lastSeen);
    if (isNaN(lastSeenMs) || lastSeenMs <= 0) {
      return false;
    }

    // Convert seconds to milliseconds if necessary
    if (lastSeenMs < 10000000000) {
      lastSeenMs = lastSeenMs * 1000;
    }

    // Reject invalid timestamps before year 2020 (e.g. millis counter prior to NTP sync)
    if (lastSeenMs < 1577836800000) {
      return false;
    }

    const diff = nowMs - lastSeenMs;

    // Handle minor clock skew between client device and server/NTP
    if (diff < 0) {
      // Skew within 15 seconds into future is tolerated as fresh
      return Math.abs(diff) < 15000;
    }

    return diff < timeoutMs;
  }

  /**
   * Distinguishes between ESP32 device online and Wi-Fi / network telemetry status.
   */
  getNetworkStatus(
    isOnline: boolean,
    connection?: DeviceConnection | null
  ): { status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN'; label: string; rssi?: number } {
    if (!isOnline) {
      return { status: 'OFFLINE', label: 'Offline' };
    }

    if (
      connection &&
      connection.signalStrength !== undefined &&
      connection.signalStrength !== null &&
      !isNaN(connection.signalStrength) &&
      connection.signalStrength !== 0
    ) {
      return {
        status: 'ONLINE',
        label: 'Jio 4G Linked',
        rssi: connection.signalStrength,
      };
    }

    return { status: 'UNKNOWN', label: 'Wi-Fi Unknown' };
  }

  /**
   * Resolves the verified motor status:
   * If ESP32 is offline, motor feedback is unreliable -> returns 'UNKNOWN'.
   */
  getEffectiveMotorStatus(reportedStatus: MotorStatus | undefined, isOnline: boolean): MotorStatus {
    if (!isOnline) {
      return 'UNKNOWN';
    }
    if (reportedStatus === 'ON' || reportedStatus === 'OFF' || reportedStatus === 'FAULT') {
      return reportedStatus;
    }
    return 'UNKNOWN';
  }

  /**
   * Gets human-readable text for how long ago the device reported a heartbeat.
   */
  getLastSeenText(lastSeen?: number | null, nowMs: number = Date.now()): string {
    if (lastSeen === undefined || lastSeen === null) return 'Never';
    let lastSeenMs = Number(lastSeen);
    if (isNaN(lastSeenMs) || lastSeenMs <= 0) return 'Never';

    if (lastSeenMs < 10000000000) {
      lastSeenMs = lastSeenMs * 1000;
    }

    if (lastSeenMs < 1577836800000) {
      return 'Never';
    }

    const seconds = Math.floor((nowMs - lastSeenMs) / 1000);
    if (seconds < 0 || seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days > 365) return 'Offline';
    return `${days}d ago`;
  }

  /**
   * Updates device schedule configuration in Firebase RTDB or local store
   */
  async updateSchedule(deviceId: string, schedule: DeviceSchedule): Promise<void> {
    if (isFirebaseConfigured && rtdb) {
      await update(ref(rtdb, `devices/${deviceId}/schedule`), schedule);
    } else {
      mockStore.updateDevice((prev) => ({
        ...prev,
        schedule,
      }));
      mockStore.addLog({
        deviceId,
        timestamp: Date.now(),
        type: 'COMMAND',
        message: `Schedule updated: ${schedule.enabled ? 'Enabled' : 'Disabled'} (${schedule.startTime || '--'} to ${schedule.stopTime || '--'})`,
        level: 'info',
      });
    }
  }

  /**
   * Updates device metadata (name, location)
   */
  async updateDeviceMetadata(deviceId: string, name: string, location?: string): Promise<void> {
    if (isFirebaseConfigured && rtdb) {
      await update(ref(rtdb, `devices/${deviceId}`), { name, location });
    } else {
      mockStore.updateDevice((prev) => ({
        ...prev,
        name,
        location,
      }));
    }
  }
}

export const deviceService = new DeviceService();
