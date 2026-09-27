import React from 'react';
import { Power, PowerOff, AlertOctagon, Loader2 } from 'lucide-react';
import { MotorStatus } from '../types/pump';

interface PumpControlsProps {
  motorStatus: MotorStatus;
  isOnline: boolean;
  pendingAction: boolean;
  onTurnOn: () => void;
  onTurnOff: () => void;
  onEmergencyOff: () => void;
}

export const PumpControls: React.FC<PumpControlsProps> = ({
  motorStatus,
  isOnline,
  pendingAction,
  onTurnOn,
  onTurnOff,
  onEmergencyOff,
}) => {
  const isRunning = motorStatus === 'ON';
  const isFault = motorStatus === 'FAULT';

  return (
    <div className="space-y-4">
      {/* Primary ON / OFF Control Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* TURN ON BUTTON */}
        <button
          onClick={onTurnOn}
          disabled={isRunning || pendingAction}
          className={`relative group overflow-hidden rounded-2xl p-6 flex items-center justify-center space-x-3 text-lg font-bold tracking-wider uppercase transition-all duration-300 shadow-xl ${
            isRunning
              ? 'bg-slate-900/60 border border-slate-800 text-slate-500 cursor-not-allowed'
              : pendingAction
              ? 'bg-emerald-950/40 border border-emerald-800/40 text-emerald-400/60 cursor-wait'
              : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-900/40 hover:shadow-emerald-700/50 hover:scale-[1.02] active:scale-[0.98]'
          }`}
        >
          {/* Subtle button sheen */}
          <div className="absolute inset-0 w-1/2 h-full bg-white/10 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-out pointer-events-none"></div>

          {pendingAction ? (
            <Loader2 className="w-6 h-6 animate-spin text-emerald-300" />
          ) : (
            <Power className="w-6 h-6" />
          )}
          <span>{isRunning ? 'PUMP IS RUNNING' : 'TURN ON PUMP'}</span>
        </button>

        {/* TURN OFF BUTTON */}
        <button
          onClick={onTurnOff}
          disabled={!isRunning || pendingAction}
          className={`relative group overflow-hidden rounded-2xl p-6 flex items-center justify-center space-x-3 text-lg font-bold tracking-wider uppercase transition-all duration-300 shadow-xl ${
            !isRunning
              ? 'bg-slate-900/60 border border-slate-800 text-slate-500 cursor-not-allowed'
              : pendingAction
              ? 'bg-slate-850 border border-slate-700 text-slate-400 cursor-wait'
              : 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white border border-slate-600/80 shadow-slate-900/50 hover:scale-[1.02] active:scale-[0.98]'
          }`}
        >
          {pendingAction ? (
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          ) : (
            <PowerOff className="w-6 h-6 text-rose-400" />
          )}
          <span>{!isRunning ? 'PUMP IS STOPPED' : 'TURN OFF PUMP'}</span>
        </button>
      </div>

      {/* Prominent High-Visibility EMERGENCY OFF Button */}
      <div className="pt-2">
        <button
          onClick={onEmergencyOff}
          className="w-full relative group overflow-hidden rounded-2xl p-4 sm:p-5 flex items-center justify-center space-x-3 text-base sm:text-lg font-black tracking-widest uppercase transition-all duration-200 bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 hover:from-rose-600 hover:via-red-500 hover:to-rose-600 text-white border-2 border-red-400/40 shadow-2xl shadow-rose-900/60 hover:shadow-rose-700/80 active:scale-[0.99]"
          title="Instant Emergency Contactor Trip"
        >
          <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none"></div>
          <AlertOctagon className="w-6 h-6 text-amber-300 animate-bounce" />
          <span className="drop-shadow-md">EMERGENCY OFF — IMMEDIATE SHUTDOWN</span>
          <AlertOctagon className="w-6 h-6 text-amber-300 animate-bounce" />
        </button>
        <p className="text-[11px] text-center text-slate-400 mt-2">
          Emergency OFF bypasses soft schedules and immediately commands the ESP32 relay to open the AC contactor.
        </p>
      </div>
    </div>
  );
};
