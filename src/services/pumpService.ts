import { rtdb, isFirebaseConfigured } from './firebase';
import { ref, set, onValue, off, serverTimestamp } from 'firebase/database';
import { DeviceCommand, CommandType, DeviceData } from '../types/pump';
import { mockStore } from './mockStore';
import { simulationService } from './simulationService';
import { deviceService } from './deviceService';

export class PumpService {
  /**
   * Dispatches a control command to the pump via Firebase Realtime Database
   * or falls back to local simulation store when Firebase is not configured.
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

    if (isFirebaseConfigured && rtdb && !simulationService.isEnabled()) {
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
      // Use mock store / simulation mode
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

      if (simulationService.isEnabled()) {
        simulationService.processCommand(deviceId, command);
      }
    }

    return command;
  }

  /**
   * Subscribes to live device status, connection, and commands in real time.
   */
  subscribeToDevice(deviceId: string, onUpdate: (data: DeviceData) => void): () => void {
    if (isFirebaseConfigured && rtdb && !simulationService.isEnabled()) {
      const deviceRef = ref(rtdb, `devices/${deviceId}`);
      const unsubscribe = onValue(
        deviceRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const raw = snapshot.val();
            const lastSeen = raw.connection?.lastSeen || 0;
            const isOnline = deviceService.isDeviceOnline({ lastSeen, online: false });

            const deviceData: DeviceData = {
              deviceId: raw.deviceId || deviceId,
              name: raw.name || 'Remote Water Pump',
              location: raw.location || 'Site Location',
              connection: {
                online: isOnline,
                lastSeen,
                signalStrength: raw.connection?.signalStrength !== undefined ? Number(raw.connection.signalStrength) : undefined,
                ipAddress: raw.connection?.ipAddress || undefined,
                firmwareVersion: raw.connection?.firmwareVersion || undefined,
              },
              command: raw.command || null,
              status: {
                motorStatus: raw.status?.motorStatus || 'UNKNOWN',
                motorStartedAt: raw.status?.motorStartedAt || null,
                lastStoppedAt: raw.status?.lastStoppedAt || null,
                lastRuntimeSeconds: Number(raw.status?.lastRuntimeSeconds || 0),
                current: raw.status?.current !== undefined ? Number(raw.status.current) : 0,
                voltage: raw.status?.voltage !== undefined ? Number(raw.status.voltage) : undefined,
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
              simulated: false,
            };
            onUpdate(deviceData);
          } else {
            // Safe initial offline state when node does not exist yet in RTDB
            onUpdate({
              deviceId,
              name: 'Remote Water Pump',
              location: 'Site Location',
              connection: {
                online: false,
                lastSeen: 0,
              },
              command: null,
              status: {
                motorStatus: 'UNKNOWN',
                motorStartedAt: null,
                lastStoppedAt: null,
                lastRuntimeSeconds: 0,
                current: 0,
                fault: false,
                faultType: 'NONE',
                todayTotalRuntimeSeconds: 0,
              },
              schedule: {
                enabled: false,
                startTime: null,
                stopTime: null,
                daysOfWeek: [],
              },
              simulated: false,
            });
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
      return mockStore.subscribeDevice((mockData) => {
        const isOnline = deviceService.isDeviceOnline(mockData.connection);
        onUpdate({
          ...mockData,
          connection: {
            ...mockData.connection,
            online: isOnline,
          },
          simulated: simulationService.isEnabled(),
        });
      });
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
