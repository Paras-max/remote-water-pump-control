import { useState, useEffect, useMemo } from 'react';
import { MotorStatus } from '../types/pump';

interface StopwatchResult {
  elapsedSeconds: number;
  formattedTime: string;      // "HH:MM:SS"
  hours: string;              // "00"
  minutes: string;            // "18"
  seconds: string;            // "32"
  isRunning: boolean;
  statusMessage: string;
}

export function useStopwatch(
  motorStatus: MotorStatus,
  motorStartedAt: number | null,
  isOnline: boolean
): StopwatchResult {
  const [now, setNow] = useState<number>(Date.now());

  // A live stopwatch is only running when the motor's actual ON state has been confirmed
  // by the ESP32 and the device is currently online.
  const isRunning =
    isOnline &&
    motorStatus === 'ON' &&
    typeof motorStartedAt === 'number' &&
    motorStartedAt > 0;

  useEffect(() => {
    if (!isRunning) return;

    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500);

    return () => clearInterval(interval);
  }, [isRunning, motorStartedAt]);

  const elapsedSeconds = useMemo(() => {
    if (!isRunning || !motorStartedAt) {
      return 0;
    }

    let startedMs = motorStartedAt;
    // Handle seconds vs milliseconds unit mismatch
    if (startedMs < 10000000000) {
      startedMs = startedMs * 1000;
    }

    // Must be a valid timestamp (>= 2020)
    if (startedMs < 1577836800000) {
      return 0;
    }

    const diff = Math.floor((now - startedMs) / 1000);
    // Guard against impossible durations (e.g. negative or > 1000 hours)
    if (diff < 0 || diff > 3600000) {
      return 0;
    }

    return diff;
  }, [isRunning, motorStartedAt, now]);

  const { formattedTime, hours, minutes, seconds } = useMemo(() => {
    const totalSecs = Math.max(0, elapsedSeconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const pad = (n: number) => String(n).padStart(2, '0');

    const h = pad(hrs);
    const m = pad(mins);
    const s = pad(secs);

    return {
      hours: h,
      minutes: m,
      seconds: s,
      formattedTime: `${h}:${m}:${s}`,
    };
  }, [elapsedSeconds]);

  const statusMessage = useMemo(() => {
    if (!isOnline) {
      return 'Offline — Live runtime timer stopped';
    }
    if (motorStatus === 'UNKNOWN') {
      return 'Motor Status Unknown';
    }
    if (motorStatus === 'FAULT') {
      return 'Pump Safety Trip — Motor halted';
    }
    if (isRunning) {
      return 'Motor confirmed ON — Synchronized with ESP32 start timestamp';
    }
    return 'Pump is currently stopped';
  }, [isOnline, motorStatus, isRunning]);

  return {
    elapsedSeconds,
    formattedTime,
    hours,
    minutes,
    seconds,
    isRunning,
    statusMessage,
  };
}
