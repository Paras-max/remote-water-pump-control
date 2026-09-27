import { DeviceData, DeviceCommand, RuntimeSession, TelemetryLogEvent } from '../types/pump';

const DEFAULT_DEVICE_ID = 'Pump-001';

const getInitialDeviceData = (): DeviceData => {
  const now = Date.now();
  return {
    deviceId: DEFAULT_DEVICE_ID,
    name: 'Field Borewell Pump #1',
    location: 'Plot 7 - Agricultural Sector',
    connection: {
      online: true,
      lastSeen: now,
      signalStrength: -68,
      ipAddress: '192.168.1.145',
      firmwareVersion: 'v2.4.1-esp32',
    },
    command: null,
    status: {
      motorStatus: 'OFF',
      motorStartedAt: null,
      lastStoppedAt: now - 1000 * 60 * 45, // 45 mins ago
      lastRuntimeSeconds: 2132, // 35m 32s
      current: 0.0,
      voltage: 232,
      fault: false,
      faultType: 'NONE',
      todayTotalRuntimeSeconds: 4252, // ~1h 10m 52s
    },
    schedule: {
      enabled: false,
      startTime: '18:00',
      stopTime: '19:00',
      daysOfWeek: [1, 2, 3, 4, 5, 6],
    },
    simulated: true,
  };
};

const getInitialSessions = (): RuntimeSession[] => {
  const now = Date.now();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  return [
    {
      id: 'sess_101',
      deviceId: DEFAULT_DEVICE_ID,
      startedAt: dayStart.getTime() + 1000 * 60 * 60 * 6 + 1000 * 60 * 15, // 06:15:00
      stoppedAt: dayStart.getTime() + 1000 * 60 * 60 * 6 + 1000 * 60 * 50 + 1000 * 20, // 06:50:20
      durationSeconds: 2120, // 35 min 20 sec
      averageCurrent: 4.25,
      faultOccurred: false,
      stopReason: 'USER_COMMAND',
    },
    {
      id: 'sess_102',
      deviceId: DEFAULT_DEVICE_ID,
      startedAt: dayStart.getTime() + 1000 * 60 * 60 * 10 + 1000 * 60 * 30, // 10:30:00
      stoppedAt: dayStart.getTime() + 1000 * 60 * 60 * 11 + 1000 * 60 * 5 + 1000 * 32, // 11:05:32
      durationSeconds: 2132, // 35 min 32 sec
      averageCurrent: 4.31,
      faultOccurred: false,
      stopReason: 'USER_COMMAND',
    },
  ];
};

const getInitialLogs = (): TelemetryLogEvent[] => {
  const now = Date.now();
  return [
    {
      id: 'log_1',
      deviceId: DEFAULT_DEVICE_ID,
      timestamp: now - 1000 * 60 * 45,
      type: 'STATE_CHANGE',
      message: 'Motor switched OFF (Normal Stop)',
      level: 'info',
    },
    {
      id: 'log_2',
      deviceId: DEFAULT_DEVICE_ID,
      timestamp: now - 1000 * 60 * 80,
      type: 'COMMAND',
      message: 'Command executed: PUMP_ON acknowledged by ESP32',
      level: 'success',
    },
    {
      id: 'log_3',
      deviceId: DEFAULT_DEVICE_ID,
      timestamp: now - 1000 * 60 * 120,
      type: 'CONNECTION',
      message: 'ESP32 connected via Jio 4G Wi-Fi hotspot (-68 dBm)',
      level: 'info',
    },
  ];
};

// Subscriber listeners
type DeviceListener = (data: DeviceData) => void;
type SessionsListener = (sessions: RuntimeSession[]) => void;
type LogsListener = (logs: TelemetryLogEvent[]) => void;

class MockStore {
  private deviceData: DeviceData;
  private sessions: RuntimeSession[];
  private logs: TelemetryLogEvent[];
  private deviceListeners: Set<DeviceListener> = new Set();
  private sessionsListeners: Set<SessionsListener> = new Set();
  private logsListeners: Set<LogsListener> = new Set();

  constructor() {
    const savedDevice = localStorage.getItem('aquaflow_mock_device');
    const savedSessions = localStorage.getItem('aquaflow_mock_sessions');
    const savedLogs = localStorage.getItem('aquaflow_mock_logs');

    this.deviceData = savedDevice ? JSON.parse(savedDevice) : getInitialDeviceData();
    this.sessions = savedSessions ? JSON.parse(savedSessions) : getInitialSessions();
    this.logs = savedLogs ? JSON.parse(savedLogs) : getInitialLogs();

    // Auto-update lastSeen in mock mode so device is online by default
    this.deviceData.connection.lastSeen = Date.now();
  }

  private save() {
    try {
      localStorage.setItem('aquaflow_mock_device', JSON.stringify(this.deviceData));
      localStorage.setItem('aquaflow_mock_sessions', JSON.stringify(this.sessions));
      localStorage.setItem('aquaflow_mock_logs', JSON.stringify(this.logs));
    } catch (e) {
      console.warn('Could not persist to localStorage:', e);
    }
  }

  public getDevice(): DeviceData {
    return { ...this.deviceData };
  }

  public updateDevice(updater: (prev: DeviceData) => DeviceData) {
    this.deviceData = updater(this.deviceData);
    this.save();
    this.deviceListeners.forEach((fn) => fn({ ...this.deviceData }));
  }

  public getSessions(): RuntimeSession[] {
    return [...this.sessions];
  }

  public addSession(session: RuntimeSession) {
    this.sessions = [session, ...this.sessions];
    this.save();
    this.sessionsListeners.forEach((fn) => fn([...this.sessions]));
  }

  public getLogs(): TelemetryLogEvent[] {
    return [...this.logs];
  }

  public addLog(log: Omit<TelemetryLogEvent, 'id'>) {
    const newLog: TelemetryLogEvent = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    this.logs = [newLog, ...this.logs.slice(0, 99)]; // Keep latest 100
    this.save();
    this.logsListeners.forEach((fn) => fn([...this.logs]));
  }

  public subscribeDevice(listener: DeviceListener): () => void {
    this.deviceListeners.add(listener);
    listener({ ...this.deviceData });
    return () => this.deviceListeners.delete(listener);
  }

  public subscribeSessions(listener: SessionsListener): () => void {
    this.sessionsListeners.add(listener);
    listener([...this.sessions]);
    return () => this.sessionsListeners.delete(listener);
  }

  public subscribeLogs(listener: LogsListener): () => void {
    this.logsListeners.add(listener);
    listener([...this.logs]);
    return () => this.logsListeners.delete(listener);
  }

  public resetMockData() {
    this.deviceData = getInitialDeviceData();
    this.sessions = getInitialSessions();
    this.logs = getInitialLogs();
    this.save();
    this.deviceListeners.forEach((fn) => fn({ ...this.deviceData }));
    this.sessionsListeners.forEach((fn) => fn([...this.sessions]));
    this.logsListeners.forEach((fn) => fn([...this.logs]));
  }
}

export const mockStore = new MockStore();
