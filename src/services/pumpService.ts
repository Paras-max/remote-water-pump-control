import { rtdb, isFirebaseConfigured } from './firebase';
import { ref, set, onValue, off, serverTimestamp } from 'firebase/database';
import { DeviceCommand, CommandType, DeviceData } from '../types/pump';
import { mockStore } from './mockStore';
import { simulationService } from './simulationService'; // Local simulator fallback

export class PumpService {
  /**
   * Dispatches a control command to the pump via Firebase Realtime Database
   * or falls back to local simulation store.
   */
  async sendCommand(deviceId: string, commandType: CommandType): Promise<DeviceCommand> {
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    const command: DeviceCommand = {
      commandId,
      command: commandType,
      createdAt: now,
      status: 'pending',
    };

    if (isFirebaseConfigured && rtdb) {
      try {
        const commandRef = ref(rtdb, `devices/${deviceId}/command`);
        await set(commandRef, {
          ...command,
          createdAt: serverTimestamp(),
        });
        console.log(`[Firebase RTDB] Dispatched command ${commandType} (${commandId})`);
      } catch (error) {
        console.error('[Firebase RTDB] Failed to dispatch command:', error);
        throw error;
      }
    } else {
      // Use mock store
      mockStore.updateDevice((prev) => ({
        ...prev,
        command,
      }));
      mockStore.addLog({
        deviceId,
        timestamp: now,
        type: 'COMMAND',
        message: `Command sent: ${commandType} (ID: ${commandId})`,
        level: 'info',
      });

      // If simulation mode is active or no ESP32 is connected, let simulation service process it
      simulationService.processCommand(deviceId, command);
    }

    return command;
  }

  /**
   * Subscribes to live device status, connection, and commands in real time.
   */
  subscribeToDevice(deviceId: string, onUpdate: (data: DeviceData) => void): () => void {
    if (isFirebaseConfigured && rtdb) {
      const deviceRef = ref(rtdb, `devices/${deviceId}`);
      const unsubscribe = onValue(
        deviceRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const raw = snapshot.val();
            const deviceData: DeviceData = {
              deviceId: raw.deviceId || deviceId,
              name: raw.name || 'Remote Water Pump',
              location: raw.location || 'Site Location',
              connection: {
                online: Boolean(raw.connection?.online),
                lastSeen: raw.connection?.lastSeen || 0,
                signalStrength: raw.connection?.signalStrength ?? -70,
                ipAddress: raw.connection?.ipAddress,
                firmwareVersion: raw.connection?.firmwareVersion,
              },
              command: raw.command || null,
              status: {
                motorStatus: raw.status?.motorStatus || 'OFF',
                motorStartedAt: raw.status?.motorStartedAt || null,
                lastStoppedAt: raw.status?.lastStoppedAt || null,
                lastRuntimeSeconds: raw.status?.lastRuntimeSeconds || 0,
                current: Number(raw.status?.current || 0),
                voltage: Number(raw.status?.voltage || 230),
                fault: Boolean(raw.status?.fault),
                faultType: raw.status?.faultType || 'NONE',
                todayTotalRuntimeSeconds: Number(raw.status?.todayTotalRuntimeSeconds || 0),
              },
              schedule: raw.schedule || {
                enabled: false,
                startTime: null,
                stopTime: null,
                daysOfWeek: [],
              },
              simulated: Boolean(raw.simulated),
            };
            onUpdate(deviceData);
          } else {
            console.warn(`[Firebase] Device ${deviceId} not found in RTDB, using defaults`);
          }
        },
        (error) => {
          console.error('[Firebase] Subscription error:', error);
        }
      );

      return () => {
        off(deviceRef);
      };
    } else {
      return mockStore.subscribeDevice(onUpdate);
    }
  }

  /**
   * Resets any fault state on the pump (clears trip)
   */
  async resetFault(deviceId: string): Promise<void> {
    await this.sendCommand(deviceId, 'RESET_FAULT');
  }

  /**
   * Sends immediate EMERGENCY_OFF command
   */
  async emergencyStop(deviceId: string): Promise<DeviceCommand> {
    return this.sendCommand(deviceId, 'EMERGENCY_OFF');
  }
}

export const pumpService = new PumpService();
