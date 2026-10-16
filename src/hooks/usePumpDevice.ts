import { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceData, CommandType } from '../types/pump';
import { pumpService } from '../services/pumpService';
import { deviceService } from '../services/deviceService';
import { isFirebaseConfigured, rtdb } from '../services/firebase';
import { ref, onValue, off } from 'firebase/database';

export type CommandPipelinePhase =
  | 'idle'
  | 'sending'
  | 'sent'
  | 'acknowledged'
  | 'motor_on'
  | 'motor_off'
  | 'timeout'
  | 'failed';

interface UsePumpDeviceResult {
  device: DeviceData | null;
  loading: boolean;
  isOnline: boolean;
  isFirebaseConnected: boolean;
  lastSeenText: string;
  pipelinePhase: CommandPipelinePhase;
  pipelineMessage: string;
  activeCommandId: string | null;
  turnOnPump: () => Promise<void>;
  turnOffPump: () => Promise<void>;
  emergencyStop: () => Promise<void>;
  resetFault: () => Promise<void>;
  pendingAction: boolean;
}

export function usePumpDevice(deviceId: string = 'Pump-001'): UsePumpDeviceResult {
  const [device, setDevice] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pipelinePhase, setPipelinePhase] = useState<CommandPipelinePhase>('idle');
  const [pipelineMessage, setPipelineMessage] = useState<string>('');
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
  // Do NOT assume ESP32 is online on application startup
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(!isFirebaseConfigured);
  const [lastSeenText, setLastSeenText] = useState<string>('Checking...');
  const timeoutRef = useRef<any>(null);

  // Monitor Firebase Web Client Connectivity (.info/connected)
  useEffect(() => {
    if (isFirebaseConfigured && rtdb) {
      const connectedRef = ref(rtdb, '.info/connected');
      onValue(connectedRef, (snap) => {
        setIsFirebaseConnected(Boolean(snap.val()));
      });
      return () => {
        off(connectedRef);
      };
    } else {
      setIsFirebaseConnected(true);
    }
  }, []);

  // Subscribe to real-time device updates
  useEffect(() => {
    setLoading(true);
    const unsubscribe = pumpService.subscribeToDevice(deviceId, (data) => {
      setDevice(data);
      const online = deviceService.isDeviceOnline(data.connection);
      setIsOnline(online);
      setLastSeenText(deviceService.getLastSeenText(data.connection?.lastSeen));
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [deviceId]);

  // Periodic heartbeat online evaluation (every 2.5 seconds)
  useEffect(() => {
    const checkConnection = () => {
      if (device) {
        const online = deviceService.isDeviceOnline(device.connection);
        setIsOnline(online);
        setLastSeenText(deviceService.getLastSeenText(device.connection?.lastSeen));
      } else {
        setIsOnline(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 2500);
    return () => clearInterval(interval);
  }, [device]);

  // Command status tracking pipeline
  useEffect(() => {
    if (!device?.command || !activeCommandId || device.command.commandId !== activeCommandId) {
      return;
    }

    const cmd = device.command;

    if (cmd.status === 'acknowledged') {
      setPipelinePhase('acknowledged');
      setPipelineMessage('Device acknowledged command (Contactor switching...)');
    } else if (cmd.status === 'executed') {
      if (device.status.motorStatus === 'ON') {
        setPipelinePhase('motor_on');
        setPipelineMessage('Motor confirmed ON (Telemetry verified)');
      } else if (device.status.motorStatus === 'OFF') {
        setPipelinePhase('motor_off');
        setPipelineMessage('Motor confirmed OFF (Contactor disengaged)');
      }

      // Clear pipeline message after 3.5 seconds
      const clearTimer = setTimeout(() => {
        setPipelinePhase('idle');
        setPipelineMessage('');
        setActiveCommandId(null);
      }, 3500);

      return () => clearTimeout(clearTimer);
    } else if (cmd.status === 'failed') {
      setPipelinePhase('failed');
      setPipelineMessage(cmd.errorMessage || 'Command execution failed on device');
    }
  }, [device?.command, device?.status.motorStatus, activeCommandId]);

  const dispatchCommand = useCallback(
    async (type: CommandType) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      try {
        setPipelinePhase('sending');
        setPipelineMessage('Sending command to cloud queue...');

        const sentCmd = await pumpService.sendCommand(deviceId, type);
        setActiveCommandId(sentCmd.commandId);

        setPipelinePhase('sent');
        setPipelineMessage('Command queued in cloud. Awaiting ESP32 acknowledgement...');

        // Watchdog timeout: if device doesn't respond within 12 seconds
        timeoutRef.current = setTimeout(() => {
          setPipelinePhase('timeout');
          setPipelineMessage('Device not responding — Motor state unconfirmed');
        }, 12000);
      } catch (error: any) {
        setPipelinePhase('failed');
        setPipelineMessage(error?.message || 'Failed to dispatch command');
      }
    },
    [deviceId]
  );

  const turnOnPump = useCallback(async () => {
    await dispatchCommand('PUMP_ON');
  }, [dispatchCommand]);

  const turnOffPump = useCallback(async () => {
    await dispatchCommand('PUMP_OFF');
  }, [dispatchCommand]);

  const emergencyStop = useCallback(async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    try {
      setPipelinePhase('sending');
      setPipelineMessage('🚨 Disagreeing Contactor: EMERGENCY SHUTDOWN...');
      const sentCmd = await pumpService.emergencyStop(deviceId);
      setActiveCommandId(sentCmd.commandId);
      setPipelinePhase('sent');
      setPipelineMessage('EMERGENCY command sent to hardware bus');

      timeoutRef.current = setTimeout(() => {
        setPipelinePhase('timeout');
        setPipelineMessage('Emergency command sent, awaiting ESP32 shutdown confirmation');
      }, 8000);
    } catch (err: any) {
      setPipelinePhase('failed');
      setPipelineMessage(err?.message || 'Emergency stop failed');
    }
  }, [deviceId]);

  const resetFault = useCallback(async () => {
    await dispatchCommand('RESET_FAULT');
  }, [dispatchCommand]);

  const pendingAction =
    pipelinePhase === 'sending' || pipelinePhase === 'sent' || pipelinePhase === 'acknowledged';

  // Automated Schedule Background Monitor (only executes if device is online)
  useEffect(() => {
    if (!device?.schedule?.enabled || !device.schedule.startTime || !device.schedule.stopTime) {
      return;
    }

    const checkSchedule = () => {
      // Do NOT dispatch automated commands if device is known to be offline
      if (!isOnline) return;

      const now = new Date();
      const currentDay = now.getDay();
      const activeDays = device.schedule?.daysOfWeek || [];
      if (!activeDays.includes(currentDay)) return;

      const pad = (n: number) => String(n).padStart(2, '0');
      const currentTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const start = device.schedule!.startTime!;
      const stop = device.schedule!.stopTime!;

      const isMotorOn = device.status.motorStatus === 'ON';
      const isFault = device.status.motorStatus === 'FAULT' || device.status.fault;

      // Inside start-stop window
      if (currentTimeStr >= start && currentTimeStr < stop) {
        if (!isMotorOn && !isFault && !pendingAction) {
          console.log(`[Scheduler] Auto starting pump for scheduled slot (${start} - ${stop})`);
          turnOnPump();
        }
      } else if (currentTimeStr >= stop) {
        if (isMotorOn && !pendingAction) {
          console.log(`[Scheduler] Auto stopping pump after scheduled slot (${stop})`);
          turnOffPump();
        }
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 15000);
    return () => clearInterval(interval);
  }, [device?.schedule, device?.status?.motorStatus, device?.status?.fault, isOnline, pendingAction, turnOnPump, turnOffPump]);

  return {
    device,
    loading,
    isOnline,
    isFirebaseConnected,
    lastSeenText,
    pipelinePhase,
    pipelineMessage,
    activeCommandId,
    turnOnPump,
    turnOffPump,
    emergencyStop,
    resetFault,
    pendingAction,
  };
}
