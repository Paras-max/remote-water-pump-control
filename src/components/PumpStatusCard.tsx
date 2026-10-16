import React, { useMemo } from 'react';
import {
  Play,
  Square,
  Clock,
  Zap,
  AlertTriangle,
  Waves,
  Calendar,
  History,
} from 'lucide-react';
import { DeviceStatus, RuntimeSession } from '../types/pump';
import { useStopwatch } from '../hooks/useStopwatch';
import { sessionService } from '../services/sessionService';

interface PumpStatusCardProps {
  status: DeviceStatus;
  isOnline: boolean;
  simulated?: boolean;
  sessions?: RuntimeSession[];
  onResetFault?: () => void;
}

export const PumpStatusCard: React.FC<PumpStatusCardProps> = ({
  status,
  isOnline,
  simulated,
  sessions = [],
  onResetFault,
}) => {
  const {
    motorStatus,
    motorStartedAt,
    lastStoppedAt,
    lastRuntimeSeconds,
    current,
    fault,
    faultType,
    todayTotalRuntimeSeconds,
  } = status;

  // Live stopwatch hook: ONLY runs when isOnline is true and motor is confirmed ON
  const stopwatch = useStopwatch(motorStatus, motorStartedAt, isOnline);

  const isConfirmedRunning = isOnline && motorStatus === 'ON';
  const isFault = isOnline && (motorStatus === 'FAULT' || fault);

  // Format timestamp helper
  const formatTime = (ts: number | null) => {
    if (!ts) return '--:--:--';
    const normalized = sessionService.normalizeTimestamp(ts);
    if (!normalized) return '--:--:--';
    return new Date(normalized).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  // Format seconds into "01h 10m 57s"
  const formatDurationDisplay = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`;
  };

  // Calculate Today's Total Runtime using calendar boundary / midnight splitting
  const todayTotalSeconds = useMemo(() => {
    if (sessions.length > 0) {
      return sessionService.calculateTodayTotalSeconds(
        sessions,
        motorStartedAt,
        isConfirmedRunning
      );
    }
    // Fallback if session history not yet loaded
    const base = Number(todayTotalRuntimeSeconds) || 0;
    return base + (isConfirmedRunning ? stopwatch.elapsedSeconds : 0);
  }, [sessions, motorStartedAt, isConfirmedRunning, stopwatch.elapsedSeconds, todayTotalRuntimeSeconds]);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 transition-all duration-500 border ${
        isFault
          ? 'glass-panel-danger'
          : isConfirmedRunning
          ? 'glass-panel-glow'
          : 'glass-panel border-slate-800'
      }`}
    >
      {/* Background Animated Impeller Glow for Active Running */}
      {isConfirmedRunning && (
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/30 rounded-full blur-3xl animate-pulse-slow"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"></div>
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-emerald-500/10 to-transparent"></div>
        </div>
      )}

      {/* Top Header Row: System Identity & Status Badge */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Waves
            className={`w-5 h-5 ${
              isConfirmedRunning ? 'text-emerald-400 animate-bounce' : 'text-slate-500'
            }`}
          />
          <span className="text-xs sm:text-sm font-semibold tracking-wider uppercase text-slate-400">
            Water Pump Telemetry
          </span>
          {simulated && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-purple-950/80 border border-purple-700 text-purple-300">
              SIMULATED
            </span>
          )}
        </div>

        {/* Large Status Badge — Strictly reports UNKNOWN when device is offline */}
        <div
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold tracking-wider uppercase shadow-inner ${
            !isOnline
              ? 'bg-amber-950/80 text-amber-300 border border-amber-700/80'
              : isFault
              ? 'bg-rose-950/80 text-rose-300 border border-rose-700/80'
              : isConfirmedRunning
              ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 shadow-emerald-900/50'
              : 'bg-slate-900/90 text-slate-400 border border-slate-700'
          }`}
        >
          {!isOnline ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>🟡 ESP32 OFFLINE — STATUS UNKNOWN</span>
            </>
          ) : isFault ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span>⚠️ PUMP FAULT</span>
            </>
          ) : isConfirmedRunning ? (
            <>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
              </span>
              <span>🟢 PUMP ON (CONFIRMED)</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              <span>🔴 PUMP OFF</span>
            </>
          )}
        </div>
      </div>

      {/* Centerpiece: Section A — Current Runtime Stopwatch */}
      <div className="relative z-10 my-8 text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 text-xs font-medium uppercase tracking-widest mb-3">
          <Clock
            className={`w-3.5 h-3.5 ${
              isConfirmedRunning ? 'text-emerald-400 animate-spin-slow' : 'text-slate-500'
            }`}
          />
          <span>Current Runtime</span>
        </div>

        {/* Stopwatch Digits: HH : MM : SS */}
        <div className="flex items-center justify-center space-x-2 sm:space-x-3 text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight font-mono-digits">
          <div className="flex flex-col items-center">
            <span
              className={`p-2 sm:p-3 rounded-2xl border backdrop-blur-md ${
                isConfirmedRunning
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              {isConfirmedRunning ? stopwatch.hours : '--'}
            </span>
            <span className="text-[10px] sm:text-xs font-sans text-slate-500 mt-1 uppercase font-medium">
              Hours
            </span>
          </div>

          <span
            className={`text-2xl sm:text-4xl ${
              isConfirmedRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-600'
            }`}
          >
            :
          </span>

          <div className="flex flex-col items-center">
            <span
              className={`p-2 sm:p-3 rounded-2xl border backdrop-blur-md ${
                isConfirmedRunning
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              {isConfirmedRunning ? stopwatch.minutes : '--'}
            </span>
            <span className="text-[10px] sm:text-xs font-sans text-slate-500 mt-1 uppercase font-medium">
              Minutes
            </span>
          </div>

          <span
            className={`text-2xl sm:text-4xl ${
              isConfirmedRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-600'
            }`}
          >
            :
          </span>

          <div className="flex flex-col items-center">
            <span
              className={`p-2 sm:p-3 rounded-2xl border backdrop-blur-md ${
                isConfirmedRunning
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 shadow-lg shadow-emerald-900/30'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              {isConfirmedRunning ? stopwatch.seconds : '--'}
            </span>
            <span className="text-[10px] sm:text-xs font-sans text-slate-500 mt-1 uppercase font-medium">
              Seconds
            </span>
          </div>
        </div>

        {/* Stopwatch state / explanation */}
        <p className="mt-2 text-xs text-slate-400">
          {!isOnline
            ? 'Hardware is offline — Live timer paused to prevent inaccurate telemetry'
            : isConfirmedRunning
            ? '⚡ Live Stopwatch — Elapsed time computed from ESP32 motor start timestamp'
            : 'Motor stopped — Stopwatch ready for next verified run cycle'}
        </p>
      </div>

      {/* Fault Alert Banner if tripped */}
      {isFault && (
        <div className="relative z-10 mb-6 p-4 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-rose-200 flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-rose-300">
                Pump Safety Trip: {faultType || 'Contactor Trip'}
              </div>
              <div className="text-xs text-rose-300/80">
                Current sensor detected irregular condition. Motor halted to protect borewell pump.
              </div>
            </div>
          </div>
          {onResetFault && (
            <button
              onClick={onResetFault}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shrink-0"
            >
              Reset Fault Lock
            </button>
          )}
        </div>
      )}

      {/* Telemetry Summary Strip: Sections B & C separated clearly */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-800/80 text-left">
        {/* Metric 1: Last Completed Runtime (Fixed duration from previous cycle) */}
        <div className="bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/60">
          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span>Last Completed Runtime</span>
          </div>
          <div className="text-sm sm:text-base font-bold text-slate-200 font-mono-digits mt-1">
            {lastRuntimeSeconds > 0 ? formatDurationDisplay(lastRuntimeSeconds) : '--:--:--'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Fixed duration of most recent session
          </div>
        </div>

        {/* Metric 2: Today's Total Runtime (Calendar day sum) */}
        <div className="bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/60">
          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Today's Total Runtime</span>
          </div>
          <div className="text-sm sm:text-base font-bold text-slate-200 font-mono-digits mt-1">
            {formatDurationDisplay(todayTotalSeconds)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Midnight-bounded local daily sum
          </div>
        </div>

        {/* Metric 3: Current Sensor (Amperes) */}
        <div className="bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/60">
          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
            <Zap className={`w-3.5 h-3.5 ${isOnline && current > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>Motor Current</span>
          </div>
          <div className="text-sm sm:text-base font-bold font-mono-digits mt-1 flex items-baseline space-x-1">
            {!isOnline ? (
              <span className="text-slate-500 text-xs font-sans font-medium">Unavailable</span>
            ) : (
              <>
                <span className={current > 0 ? 'text-cyan-400' : 'text-slate-400'}>
                  {current.toFixed(1)}
                </span>
                <span className="text-xs text-slate-500">Amperes</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {isOnline ? 'Real-time ACS712 feedback' : 'Sensor offline'}
          </div>
        </div>

        {/* Metric 4: Session Timestamps (Last ON / OFF) */}
        <div className="bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/60 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400 flex items-center space-x-1">
              <Play className="w-3 h-3 text-emerald-400" />
              <span>Started:</span>
            </span>
            <span className="font-mono text-slate-300 font-semibold">
              {formatTime(motorStartedAt)}
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px] mt-1 pt-1 border-t border-slate-800/40">
            <span className="text-slate-400 flex items-center space-x-1">
              <Square className="w-3 h-3 text-rose-400" />
              <span>Stopped:</span>
            </span>
            <span className="font-mono text-slate-300 font-semibold">
              {formatTime(lastStoppedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
