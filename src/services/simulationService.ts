import { DeviceCommand, RuntimeSession } from '../types/pump';
import { mockStore } from './mockStore';
import { isFirebaseConfigured, rtdb } from './firebase';

type SimulationListener = (enabled: boolean) => void;

class SimulationService {
  private isSimulationEnabled: boolean = false;
  private heartbeatIntervalId: any = null;
  private currentFluctuationId: any = null;
  private commandTimeoutId: any = null;
  private isSimulatedOffline: boolean = false;
  private simulatedFault: boolean = false;
  private listeners: Set<SimulationListener> = new Set();

  constructor() {
    let saved: string | null = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        saved = window.localStorage.getItem('aquaflow_simulation_mode');
      }
    } catch (e) {}

    // Default to FALSE so real NodeMCU/ESP32 controls the system when Firebase is configured.
    // If Firebase is not configured at all, fallback to simulation mode only for local dev demos.
    if (saved !== null) {
      this.isSimulationEnabled = saved === 'true';
    } else {
      this.isSimulationEnabled = !isFirebaseConfigured;
    }

    if (this.isSimulationEnabled && !isFirebaseConfigured) {
      this.startHeartbeat();
    }
  }

  public subscribe(listener: SimulationListener): () => void {
    this.listeners.add(listener);
    listener(this.isSimulationEnabled);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.isSimulationEnabled));
  }

  public isEnabled(): boolean {
    return this.isSimulationEnabled;
  }

  public setEnabled(enabled: boolean) {
    this.isSimulationEnabled = enabled;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('aquaflow_simulation_mode', String(enabled));
      }
    } catch (e) {}
    if (enabled) {
      this.startHeartbeat();
    } else {
      this.stopAllSimulation();
    }
    this.notify();
  }

  public toggleSimulation(): boolean {
    const next = !this.isSimulationEnabled;
    this.setEnabled(next);
    return next;
  }

  public stopAllSimulation() {
    this.stopHeartbeat();
    this.stopCurrentJitter();
    if (this.commandTimeoutId) {
      clearTimeout(this.commandTimeoutId);
      this.commandTimeoutId = null;
    }
  }

  public setSimulatedOffline(offline: boolean, deviceId: string = 'Pump-001') {
    if (!this.isSimulationEnabled) return;
    this.isSimulatedOffline = offline;
    const now = Date.now();

    if (offline) {
      this.stopHeartbeat();
      const offlineTime = now - 1000 * 60 * 5; // 5 mins ago (triggers offline threshold)
      mockStore.updateDevice((prev) => ({
        ...prev,
        simulated: true,
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
    } else {
      this.startHeartbeat(deviceId);
      mockStore.updateDevice((prev) => ({
        ...prev,
        simulated: true,
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
        message: 'ESP32 reconnected to Jio 4G dongle Wi-Fi (Simulated)',
        level: 'info',
      });
    }
  }

  public isOfflineSimulated(): boolean {
    return this.isSimulatedOffline;
  }

  public triggerFault(deviceId: string = 'Pump-001') {
    if (!this.isSimulationEnabled) return;
    this.simulatedFault = true;
    const now = Date.now();

    mockStore.updateDevice((prev) => ({
      ...prev,
      simulated: true,
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

  /**
   * Starts periodic heartbeat mimicking the ESP32 in simulation mode.
   * NEVER overwrites physical Firebase RTDB when physical hardware is connected!
   */
  public startHeartbeat(deviceId: string = 'Pump-001') {
    this.stopHeartbeat();
    if (!this.isSimulationEnabled) return;

    this.heartbeatIntervalId = setInterval(() => {
      if (this.isSimulatedOffline || !this.isSimulationEnabled) return;
      const now = Date.now();

      mockStore.updateDevice((prev) => ({
        ...prev,
        simulated: true,
        connection: {
          ...prev.connection,
          online: true,
          lastSeen: now,
        },
      }));
    }, 10000);
  }

  public stopHeartbeat() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  /**
   * Simulates the exact ESP32 execution pipeline upon receiving a command in simulation mode.
   */
  public processCommand(deviceId: string, command: DeviceCommand) {
    if (!this.isSimulationEnabled) {
      console.warn('[Simulator] Simulator is disabled. Not processing command.');
      return;
    }

    if (this.isSimulatedOffline) {
      console.warn('[Simulator] Device is simulated offline. Cannot process command.');
      return;
    }

    const commandId = command.commandId;

    // STEP 1: ESP32 reads command & Acknowledges within 700ms
    this.commandTimeoutId = setTimeout(() => {
      if (!this.isSimulationEnabled) return;
      this.updateCommandStatus(deviceId, commandId, 'acknowledged');

      // STEP 2: ESP32 activates relay / checks current sensor & sets state after another 900ms
      this.commandTimeoutId = setTimeout(() => {
        if (!this.isSimulationEnabled) return;
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

  private executeSimulatedPumpOn(deviceId: string, commandId: string) {
    const now = Date.now();
    this.simulatedFault = false;
    const simulatedCurrent = 4.24;

    mockStore.updateDevice((prev) => ({
      ...prev,
      simulated: true,
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
      message: 'Motor started successfully. Contactor closed, current stabilized at 4.24 A (Simulated)',
      level: 'success',
    });

    this.startCurrentJitter(deviceId);
  }

  private executeSimulatedPumpOff(deviceId: string, commandId: string, isEmergency: boolean) {
    const now = Date.now();
    this.stopCurrentJitter();

    const device = mockStore.getDevice();
    const startedAt = device.status.motorStartedAt || now - 1000 * 60 * 18;
    const durationSeconds = Math.max(1, Math.floor((now - startedAt) / 1000));

    const completedSession: RuntimeSession = {
      id: `sess_${Date.now()}`,
      deviceId,
      startedAt,
      stoppedAt: now,
      durationSeconds,
      averageCurrent: 4.28,
      faultOccurred: device.status.fault,
      stopReason: isEmergency ? 'EMERGENCY_OFF' : device.status.fault ? 'FAULT_TRIP' : 'USER_COMMAND',
    };

    mockStore.updateDevice((prev) => {
      const todayTotal = (prev.status.todayTotalRuntimeSeconds || 0) + durationSeconds;
      return {
        ...prev,
        simulated: true,
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

  private executeSimulatedResetFault(deviceId: string, commandId: string) {
    const now = Date.now();
    this.simulatedFault = false;

    mockStore.updateDevice((prev) => ({
      ...prev,
      simulated: true,
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

  private startCurrentJitter(deviceId: string) {
    this.stopCurrentJitter();
    if (!this.isSimulationEnabled) return;

    this.currentFluctuationId = setInterval(() => {
      if (!this.isSimulationEnabled) return;
      const current = parseFloat((4.15 + Math.random() * 0.25).toFixed(2));
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
