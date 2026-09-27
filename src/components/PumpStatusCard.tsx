import React from 'react';
import {
  Play,
  Square,
  Clock,
  Zap,
  AlertTriangle,
  RotateCw,
  Waves,
  Calendar,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { DeviceStatus, MotorStatus } from '../types/pump';
import { useStopwatch } from '../hooks/useStopwatch';

interface PumpStatusCardProps {
  status: DeviceStatus;
  isOnline: boolean;
  onResetFault?: () => void;
}

export const PumpStatusCard: React.FC<PumpStatusCardProps> = ({
  status,
  isOnline,
  onResetFault,
}) => {
  const { motorStatus, motorStartedAt, lastStoppedAt, lastRuntimeSeconds, current, fault, faultType, todayTotalRuntimeSeconds } =
    status;

  const stopwatch = useStopwatch(motorStatus, motorStartedAt, lastRuntimeSeconds);

  // Status visual configurations
  const isRunning = motorStatus === 'ON';
  const isFault = motorStatus === 'FAULT' || fault;
  const isUnknown = !isOnline || motorStatus === 'UNKNOWN';

  // Format timestamp helper
  const formatTime = (ts: number | null) => {
    if (!ts) return '--:--:--';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  // Format today's seconds into "01h 10m 57s"
  const formatTodayRuntime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`;
  };

  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 transition-all duration-500 border ${
        isFault
          ? 'glass-panel-danger'
          : isRunning
          ? 'glass-panel-glow'
          : 'glass-panel border-slate-800'
      }`}
    >
      {/* Background Animated Water / Impeller Glow for Active Running */}
      {isRunning && (
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/30 rounded-full blur-3xl animate-pulse-slow"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"></div>
          {/* Subtle water ripple waves */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-emerald-500/10 to-transparent"></div>
        </div>
      )}

      {/* Top Header Row: System Identity & Status Badge */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Waves className={`w-5 h-5 ${isRunning ? 'text-emerald-400 animate-bounce' : 'text-slate-500'}`} />
          <span className="text-xs sm:text-sm font-semibold tracking-wider uppercase text-slate-400">
            Water Pump Telemetry
          </span>
        </div>

        {/* Large Prominent Status Badge */}
        <div
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold tracking-wider uppercase shadow-inner ${
            isFault
              ? 'bg-rose-950/80 text-rose-300 border border-rose-700/80'
              : isRunning
              ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 shadow-emerald-900/50'
              : isUnknown
              ? 'bg-amber-950/80 text-amber-300 border border-amber-700/80'
              : 'bg-slate-900/90 text-slate-400 border border-slate-700'
          }`}
        >
          {isFault ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span>⚠️ PUMP FAULT</span>
            </>
          ) : isRunning ? (
            <>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
              </span>
              <span>🟢 PUMP ON</span>
            </>
          ) : isUnknown ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>🟡 STATUS UNKNOWN</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              <span>🔴 PUMP OFF</span>
            </>
          )}
        </div>
      </div>

      {/* Centerpiece: Stopwatch Runtime Display */}
      <div className="relative z-10 my-8 text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 text-xs font-medium uppercase tracking-widest mb-3">
          <Clock className={`w-3.5 h-3.5 ${isRunning ? 'text-emerald-400 animate-spin-slow' : 'text-slate-500'}`} />
          <span>{isRunning ? 'Current Motor Runtime' : 'Last Completed Runtime'}</span>
        </div>

        {/* Stopwatch Digits: HH : MM : SS */}
        <div className="flex items-center justify-center space-x-2 sm:space-x-3 text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight font-mono-digits">
          <div className="flex flex-col items-center">
            <span
              className={`p-2 sm:p-3 rounded-2xl border backdrop-blur-md ${
                isRunning
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300'
              }`}
            >
              {stopwatch.hours}
            </span>
            <span className="text-[10px] sm:text-xs font-sans text-slate-500 mt-1 uppercase font-medium">Hours</span>
          </div>

          <span className={`text-2xl sm:text-4xl ${isRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`}>
            :
          </span>

          <div className="flex flex-col items-center">
            <span
              className={`p-2 sm:p-3 rounded-2xl border backdrop-blur-md ${
                isRunning
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300'
              }`}
            >
              {stopwatch.minutes}
            </span>
            <span className="text-[10px] sm:text-xs font-sans text-slate-500 mt-1 uppercase font-medium">Minutes</span>
          </div>

          <span className={`text-2xl sm:text-4xl ${isRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`}>
            :
          </span>

          <div className="flex flex-col items-center">
            <span
              className={`p-2 sm:p-3 rounded-2xl border backdrop-blur-md ${
                isRunning
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 shadow-lg shadow-emerald-900/30'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300'
              }`}
            >
              {stopwatch.seconds}
            </span>
            <span className="text-[10px] sm:text-xs font-sans text-slate-500 mt-1 uppercase font-medium">Seconds</span>
          </div>
        </div>

        {/* Stopwatch explanation note */}
        <p className="mt-2 text-xs text-slate-400">
          {isRunning
            ? '⚡ Stopwatch live — synchronizing with ESP32 start timestamp across all devices'
            : 'Static timestamp-preserved duration from previous pump cycle'}
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

      {/* Telemetry Summary Strip */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800/80 text-left">
        {/* Today's Total Runtime */}
        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/60">
          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>Today's Total</span>
          </div>
          <div className="text-sm sm:text-base font-bold text-slate-200 font-mono-digits mt-1">
            {formatTodayRuntime(todayTotalRuntimeSeconds + (isRunning ? stopwatch.elapsedSeconds : 0))}
          </div>
        </div>

        {/* Current Sensor */}
        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/60">
          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
            <Zap className={`w-3.5 h-3.5 ${current > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>Motor Current</span>
          </div>
          <div className="text-sm sm:text-base font-bold font-mono-digits mt-1 flex items-baseline space-x-1">
            <span className={current > 0 ? 'text-cyan-400' : 'text-slate-400'}>
              {current.toFixed(1)}
            </span>
            <span className="text-xs text-slate-500">Amperes</span>
          </div>
        </div>

        {/* Last ON Time */}
        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/60">
          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span>Last ON Time</span>
          </div>
          <div className="text-xs sm:text-sm font-semibold text-slate-300 font-mono-digits mt-1">
            {formatTime(motorStartedAt)}
          </div>
        </div>

        {/* Last OFF Time */}
        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/60">
          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-medium">
            <Square className="w-3.5 h-3.5 text-rose-400" />
            <span>Last OFF Time</span>
          </div>
          <div className="text-xs sm:text-sm font-semibold text-slate-300 font-mono-digits mt-1">
            {formatTime(lastStoppedAt)}
          </div>
        </div>
      </div>
    </div>
  );
};
