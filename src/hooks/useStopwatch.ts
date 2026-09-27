import { useState, useEffect, useMemo } from 'react';
import { MotorStatus } from '../types/pump';

interface StopwatchResult {
  elapsedSeconds: number;
  formattedTime: string;      // "HH:MM:SS"
  hours: string;              // "00"
  minutes: string;            // "18"
  seconds: string;            // "32"
  isRunning: boolean;
}

export function useStopwatch(
  motorStatus: MotorStatus,
  motorStartedAt: number | null,
  lastRuntimeSeconds: number = 0
): StopwatchResult {
  const [now, setNow] = useState<number>(Date.now());

  const isRunning = motorStatus === 'ON' && typeof motorStartedAt === 'number' && motorStartedAt > 0;

  useEffect(() => {
    if (!isRunning) return;

    // Fast initial sync
    setNow(Date.now());

    // Continuous visual refresh interval (only ticks display, actual elapsed is derived from timestamps)
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500);

    return () => clearInterval(interval);
  }, [isRunning, motorStartedAt]);

  const elapsedSeconds = useMemo(() => {
    if (isRunning && motorStartedAt) {
      const diff = Math.floor((now - motorStartedAt) / 1000);
      return diff > 0 ? diff : 0;
    }
    // When motor is OFF, retain the last completed runtime duration
    return lastRuntimeSeconds || 0;
  }, [isRunning, motorStartedAt, now, lastRuntimeSeconds]);

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

  return {
    elapsedSeconds,
    formattedTime,
    hours,
    minutes,
    seconds,
    isRunning,
  };
}
