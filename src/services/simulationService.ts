import { DeviceCommand, RuntimeSession } from '../types/pump';
import { mockStore } from './mockStore';
import { isFirebaseConfigured, rtdb } from './firebase';
import { ref, update, set, serverTimestamp } from 'firebase/database';

class SimulationService {
  private isSimulationEnabled: boolean = true;
  private heartbeatIntervalId: any = null;
  private currentFluctuationId: any = null;
  private isSimulatedOffline: boolean = false;
  private simulatedFault: boolean = false;

  constructor() {
    const saved = localStorage.getItem('aquaflow_simulation_mode');
    this.isSimulationEnabled = saved !== null ? saved === 'true' : true;
    this.startHeartbeat();
  }

  public isEnabled(): boolean {
    return this.isSimulationEnabled;
  }

  public setEnabled(enabled: boolean) {
    this.isSimulationEnabled = enabled;
    localStorage.setItem('aquaflow_simulation_mode', String(enabled));
    if (enabled) {
      this.startHeartbeat();
    } else {
      this.stopHeartbeat();
    }
  }

  public toggleSimulation(): boolean {
    const next = !this.isSimulationEnabled;
    this.setEnabled(next);
    return next;
  }

  public setSimulatedOffline(offline: boolean, deviceId: string = 'Pump-001') {
    this.isSimulatedOffline = offline;
    const now = Date.now();

    if (offline) {
      this.stopHeartbeat();
      const offlineTime = now - 1000 * 60 * 5; // 5 mins ago (triggers offline threshold)
      if (isFirebaseConfigured && rtdb) {
        update(ref(rtdb, `devices/${deviceId}/connection`), {
          online: false,
          lastSeen: offlineTime,
        });
      } else {
        mockStore.updateDevice((prev) => ({
          ...prev,
          connection: {
            ...prev.connection,
            online: false,
            lastSeen: offlineTime,
          },
        }));
        mockStore.addLog({
          deviceId,
          timestamp: now,
          type: 'CONNECTION',
          message: 'ESP32 simulated connection loss (Jio 4G signal lost)',
          level: 'error',
        });
      }
    } else {
      this.startHeartbeat();
      if (isFirebaseConfigured && rtdb) {
        update(ref(rtdb, `devices/${deviceId}/connection`), {
          online: true,
          lastSeen: serverTimestamp(),
        });
      } else {
        mockStore.updateDevice((prev) => ({
          ...prev,
          connection: {
            ...prev.connection,
            online: true,
            lastSeen: now,
          },
        }));
        mockStore.addLog({
          deviceId,
          timestamp: now,
          type: 'CONNECTION',
          message: 'ESP32 reconnected to Jio 4G dongle Wi-Fi',
          level: 'info',
        });
      }
    }
  }

  public isOfflineSimulated(): boolean {
    return this.isSimulatedOffline;
  }

  public triggerFault(deviceId: string = 'Pump-001') {
    this.simulatedFault = true;
    const now = Date.now();

    // In a fault: command might be ON, but motor trips or current is 0A
    if (isFirebaseConfigured && rtdb) {
      update(ref(rtdb, `devices/${deviceId}/status`), {
        motorStatus: 'FAULT',
        fault: true,
        faultType: 'NO_CURRENT_DETECTED',
        current: 0.0,
      });
    } else {
      mockStore.updateDevice((prev) => ({
        ...prev,
        status: {
          ...prev.status,
          motorStatus: 'FAULT',
          fault: true,
          faultType: 'NO_CURRENT_DETECTED',
          current: 0.0,
        },
      }));
      mockStore.addLog({
        deviceId,
        timestamp: now,
        type: 'FAULT',
        message: 'CRITICAL FAULT: Contactor engaged but 0.0A detected! Possible dry-run or phase failure.',
        level: 'error',
      });
    }
  }

  /**
   * Starts periodic heartbeat mimicking the ESP32 publishing every 10 seconds.
   */
  public startHeartbeat(deviceId: string = 'Pump-001') {
    if (this.heartbeatIntervalId) return;

    this.heartbeatIntervalId = setInterval(() => {
      if (this.isSimulatedOffline) return;
      const now = Date.now();

      if (isFirebaseConfigured && rtdb) {
        update(ref(rtdb, `devices/${deviceId}/connection`), {
          online: true,
          lastSeen: serverTimestamp(),
        });
      } else {
        mockStore.updateDevice((prev) => ({
          ...prev,
          connection: {
            ...prev.connection,
            online: true,
            lastSeen: now,
          },
        }));
      }
    }, 10000);
  }

  public stopHeartbeat() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  /**
   * Simulates the exact ESP32 execution pipeline upon receiving a command.
   */
  public processCommand(deviceId: string, command: DeviceCommand) {
    if (!this.isSimulationEnabled) return;

    if (this.isSimulatedOffline) {
      console.warn('[Simulator] Device is simulated offline. Cannot process command.');
      return;
    }

    const commandId = command.commandId;

    // STEP 1: ESP32 reads command from RTDB & Acknowledges within 700ms
    setTimeout(() => {
      this.updateCommandStatus(deviceId, commandId, 'acknowledged');

      // STEP 2: ESP32 activates relay / checks current sensor & sets state after another 900ms
      setTimeout(() => {
        if (command.command === 'PUMP_ON') {
          this.executeSimulatedPumpOn(deviceId, commandId);
        } else if (command.command === 'PUMP_OFF' || command.command === 'EMERGENCY_OFF') {
          this.executeSimulatedPumpOff(deviceId, commandId, command.command === 'EMERGENCY_OFF');
        } else if (command.command === 'RESET_FAULT') {
          this.executeSimulatedResetFault(deviceId, commandId);
        }
      }, 900);
    }, 700);
  }

  private updateCommandStatus(deviceId: string, commandId: string, status: any) {
    if (isFirebaseConfigured && rtdb) {
      update(ref(rtdb, `devices/${deviceId}/command`), {
        status,
        acknowledgedAt: serverTimestamp(),
      });
    } else {
      mockStore.updateDevice((prev) => {
        if (prev.command && prev.command.commandId === commandId) {
          return {
            ...prev,
            command: {
              ...prev.command,
              status,
              acknowledgedAt: Date.now(),
            },
          };
        }
        return prev;
      });
    }
  }

  private executeSimulatedPumpOn(deviceId: string, commandId: string) {
    const now = Date.now();
    this.simulatedFault = false;

    // Simulated motor current (nominal 4.2 A with minor sensor jitter)
    const simulatedCurrent = 4.24;

    if (isFirebaseConfigured && rtdb) {
      update(ref(rtdb, `devices/${deviceId}/status`), {
        motorStatus: 'ON',
        motorStartedAt: serverTimestamp(),
        current: simulatedCurrent,
        fault: false,
        faultType: 'NONE',
      });
      update(ref(rtdb, `devices/${deviceId}/command`), {
        status: 'executed',
        executedAt: serverTimestamp(),
      });
    } else {
      mockStore.updateDevice((prev) => ({
        ...prev,
        command: prev.command ? { ...prev.command, status: 'executed', executedAt: now } : null,
        status: {
          ...prev.status,
          motorStatus: 'ON',
          motorStartedAt: now,
          current: simulatedCurrent,
          fault: false,
          faultType: 'NONE',
        },
      }));

      mockStore.addLog({
        deviceId,
        timestamp: now,
        type: 'STATE_CHANGE',
        message: 'Motor started successfully. Contactor closed, current stabilized at 4.24 A',
        level: 'success',
      });
    }

    // Start small realistic current fluctuation
    this.startCurrentJitter(deviceId);
  }

  private executeSimulatedPumpOff(deviceId: string, commandId: string, isEmergency: boolean) {
    const now = Date.now();
    this.stopCurrentJitter();

    const device = mockStore.getDevice();
    const startedAt = device.status.motorStartedAt || (now - 1000 * 60 * 18); // fallback
    const durationSeconds = Math.max(1, Math.floor((now - startedAt) / 1000));

    const completedSession: RuntimeSession = {
      id: `sess_${Date.now()}`,
      deviceId,
      startedAt,
      stoppedAt: now,
      durationSeconds,
      averageCurrent: 4.28,
      faultOccurred: device.status.fault,
      stopReason: isEmergency ? 'EMERGENCY_OFF' : (device.status.fault ? 'FAULT_TRIP' : 'USER_COMMAND'),
    };

    if (isFirebaseConfigured && rtdb) {
      update(ref(rtdb, `devices/${deviceId}/status`), {
        motorStatus: 'OFF',
        motorStartedAt: null,
        lastStoppedAt: serverTimestamp(),
        lastRuntimeSeconds: durationSeconds,
        current: 0.0,
      });
      update(ref(rtdb, `devices/${deviceId}/command`), {
        status: 'executed',
        executedAt: serverTimestamp(),
      });

      // Save session to history in RTDB/Firestore
      const sessionRef = ref(rtdb, `devices/${deviceId}/sessions/${completedSession.id}`);
      set(sessionRef, completedSession);
    } else {
      mockStore.updateDevice((prev) => {
        const todayTotal = (prev.status.todayTotalRuntimeSeconds || 0) + durationSeconds;
        return {
          ...prev,
          command: prev.command ? { ...prev.command, status: 'executed', executedAt: now } : null,
          status: {
            ...prev.status,
            motorStatus: 'OFF',
            motorStartedAt: null,
            lastStoppedAt: now,
            lastRuntimeSeconds: durationSeconds,
            current: 0.0,
            todayTotalRuntimeSeconds: todayTotal,
          },
        };
      });

      mockStore.addSession(completedSession);
      mockStore.addLog({
        deviceId,
        timestamp: now,
        type: 'STATE_CHANGE',
        message: `Motor stopped (${isEmergency ? 'EMERGENCY SHUTDOWN' : 'Normal'}). Duration: ${durationSeconds}s.`,
        level: isEmergency ? 'warning' : 'info',
      });
    }
  }

  private executeSimulatedResetFault(deviceId: string, commandId: string) {
    const now = Date.now();
    this.simulatedFault = false;

    if (isFirebaseConfigured && rtdb) {
      update(ref(rtdb, `devices/${deviceId}/status`), {
        fault: false,
        faultType: 'NONE',
        motorStatus: 'OFF',
      });
      update(ref(rtdb, `devices/${deviceId}/command`), {
        status: 'executed',
        executedAt: serverTimestamp(),
      });
    } else {
      mockStore.updateDevice((prev) => ({
        ...prev,
        command: prev.command ? { ...prev.command, status: 'executed', executedAt: now } : null,
        status: {
          ...prev.status,
          fault: false,
          faultType: 'NONE',
          motorStatus: 'OFF',
        },
      }));
      mockStore.addLog({
        deviceId,
        timestamp: now,
        type: 'STATE_CHANGE',
        message: 'Motor trip lock reset. Ready for normal operation.',
        level: 'info',
      });
    }
  }

  private startCurrentJitter(deviceId: string) {
    this.stopCurrentJitter();
    this.currentFluctuationId = setInterval(() => {
      const current = parseFloat((4.15 + Math.random() * 0.25).toFixed(2));
      if (!isFirebaseConfigured) {
        mockStore.updateDevice((prev) => {
          if (prev.status.motorStatus !== 'ON') return prev;
          return {
            ...prev,
            status: {
              ...prev.status,
              current,
            },
          };
        });
      }
    }, 3000);
  }

  private stopCurrentJitter() {
    if (this.currentFluctuationId) {
      clearInterval(this.currentFluctuationId);
      this.currentFluctuationId = null;
    }
  }
}

export const simulationService = new SimulationService();
