import { DeviceConnection, DeviceSchedule } from '../types/pump';
import { isFirebaseConfigured, rtdb } from './firebase';
import { ref, update } from 'firebase/database';
import { mockStore } from './mockStore';

// Maximum threshold before considering device offline (45 seconds)
export const HEARTBEAT_TIMEOUT_MS = 45000;

export class DeviceService {
  /**
   * Evaluates if a device is genuinely online based on its latest heartbeat timestamp.
   * Do NOT assume online merely because Firebase is connected!
   */
  isDeviceOnline(connection: DeviceConnection): boolean {
    if (!connection || !connection.lastSeen) return false;
    let lastSeenMs = connection.lastSeen;
    if (lastSeenMs < 10000000000) {
      lastSeenMs = lastSeenMs * 1000;
    }
    const now = Date.now();
    const diff = now - lastSeenMs;
    return diff >= 0 && diff < HEARTBEAT_TIMEOUT_MS;
  }

  /**
   * Gets human-readable text for how long ago the device reported a heartbeat.
   */
  getLastSeenText(lastSeen: number): string {
    if (!lastSeen) return 'Never';
    let lastSeenMs = lastSeen;
    if (lastSeenMs < 10000000000) {
      lastSeenMs = lastSeenMs * 1000;
    }
    const now = Date.now();
    const seconds = Math.floor((now - lastSeenMs) / 1000);
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
