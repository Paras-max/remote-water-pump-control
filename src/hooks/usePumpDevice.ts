import { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceData, CommandType, CommandStatus } from '../types/pump';
import { pumpService } from '../services/pumpService';
import { deviceService } from '../services/deviceService';

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
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastSeenText, setLastSeenText] = useState<string>('Just now');
  const timeoutRef = useRef<any>(null);

  // Subscribe to real-time device updates
  useEffect(() => {
    setLoading(true);
    const unsubscribe = pumpService.subscribeToDevice(deviceId, (data) => {
      setDevice(data);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [deviceId]);

  // Periodic heartbeat online evaluation (every 4 seconds)
  useEffect(() => {
    const checkConnection = () => {
      if (device) {
        const online = deviceService.isDeviceOnline(device.connection);
        setIsOnline(online);
        setLastSeenText(deviceService.getLastSeenText(device.connection.lastSeen));
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 4000);
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
        setPipelineMessage('Motor confirmed ON (Current verified)');
      } else if (device.status.motorStatus === 'OFF') {
        setPipelinePhase('motor_off');
        setPipelineMessage('Motor confirmed OFF');
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
        setPipelineMessage('Sending command to cloud...');

        const sentCmd = await pumpService.sendCommand(deviceId, type);
        setActiveCommandId(sentCmd.commandId);

        setPipelinePhase('sent');
        setPipelineMessage('Command sent. Waiting for ESP32...');

        // Watchdog timeout: if device doesn't respond within 12 seconds
        timeoutRef.current = setTimeout(() => {
          setPipelinePhase('timeout');
          setPipelineMessage('Device not responding — Motor status unknown');
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
      setPipelineMessage('EMERGENCY command sent to hardware');

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

  const pendingAction = pipelinePhase === 'sending' || pipelinePhase === 'sent' || pipelinePhase === 'acknowledged';

  return {
    device,
    loading,
    isOnline,
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
