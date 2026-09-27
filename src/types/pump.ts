export type MotorStatus = 'ON' | 'OFF' | 'FAULT' | 'UNKNOWN';

export type CommandType = 'PUMP_ON' | 'PUMP_OFF' | 'EMERGENCY_OFF' | 'RESET_FAULT';

export type CommandStatus = 'pending' | 'sent' | 'acknowledged' | 'executed' | 'failed' | 'timeout';

export interface DeviceCommand {
  commandId: string;
  command: CommandType;
  createdAt: number; // Unix timestamp in milliseconds
  status: CommandStatus;
  acknowledgedAt?: number;
  executedAt?: number;
  errorMessage?: string;
}

export interface DeviceConnection {
  online: boolean;
  lastSeen: number; // Unix timestamp in milliseconds
  signalStrength?: number; // RSSI or dBm (e.g. -65 dBm for 4G/Wi-Fi)
  ipAddress?: string;
  firmwareVersion?: string;
}

export interface DeviceStatus {
  motorStatus: MotorStatus;
  motorStartedAt: number | null; // Unix timestamp in milliseconds when actual motor started
  lastStoppedAt: number | null;  // Unix timestamp in milliseconds when actual motor stopped
  lastRuntimeSeconds: number;     // Duration of last completed run
  current: number;               // Measured current in Amperes (e.g. 4.2 A)
  voltage?: number;              // AC Voltage (e.g. 230 V)
  fault: boolean;                // Motor fault flag (dry run, overload, no current on ON)
  faultType?: 'NONE' | 'NO_CURRENT_DETECTED' | 'OVERLOAD' | 'CONTACTOR_FAILURE' | 'DRY_RUN';
  todayTotalRuntimeSeconds: number; // Sum of runtime for today in seconds
}

export interface DeviceSchedule {
  enabled: boolean;
  startTime: string | null; // "18:00"
  stopTime: string | null;  // "19:00"
  daysOfWeek: number[];     // [0, 1, 2, 3, 4, 5, 6]
}

export interface DeviceData {
  deviceId: string;
  name: string;
  location?: string;
  connection: DeviceConnection;
  command?: DeviceCommand | null;
  status: DeviceStatus;
  schedule?: DeviceSchedule;
  simulated?: boolean;
}

export interface RuntimeSession {
  id: string;
  deviceId: string;
  startedAt: number;   // Timestamp
  stoppedAt: number;   // Timestamp
  durationSeconds: number;
  averageCurrent: number;
  faultOccurred: boolean;
  stopReason: 'USER_COMMAND' | 'EMERGENCY_OFF' | 'FAULT_TRIP' | 'SCHEDULE' | 'UNKNOWN';
}

export interface TelemetryLogEvent {
  id: string;
  deviceId: string;
  timestamp: number;
  type: 'COMMAND' | 'STATE_CHANGE' | 'FAULT' | 'CONNECTION';
  message: string;
  details?: Record<string, any>;
  level: 'info' | 'warning' | 'error' | 'success';
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isDemo?: boolean;
}
