import React from 'react';
import { Wifi, WifiOff, Cpu, ShieldCheck, AlertTriangle, Zap, Gauge, Radio } from 'lucide-react';
import { DeviceStatus, DeviceConnection } from '../types/pump';

interface TelemetryGridProps {
  status: DeviceStatus;
  connection: DeviceConnection;
  isOnline: boolean;
  lastSeenText: string;
}

export const TelemetryGrid: React.FC<TelemetryGridProps> = ({
  status,
  connection,
  isOnline,
  lastSeenText,
}) => {
  const { motorStatus, current, voltage = 230, fault, faultType } = status;

  // Motor state classification
  const getMotorLabel = () => {
    if (!isOnline) return { label: 'Status Unknown', color: 'text-amber-400', badge: 'bg-amber-950/60 border-amber-800 text-amber-300' };
    if (fault || motorStatus === 'FAULT') return { label: 'Possible Fault', color: 'text-rose-400', badge: 'bg-rose-950/60 border-rose-800 text-rose-300' };
    if (motorStatus === 'ON') return { label: 'Motor Running', color: 'text-emerald-400', badge: 'bg-emerald-950/60 border-emerald-800 text-emerald-300' };
    return { label: 'Motor OFF', color: 'text-slate-400', badge: 'bg-slate-900 border-slate-700 text-slate-400' };
  };

  const motorInfo = getMotorLabel();

  // Current bar percentage (nominal max ~ 8.0 A for borehole pump)
  const maxRatedCurrent = 8.0;
  const currentPercent = Math.min(100, Math.max(0, (current / maxRatedCurrent) * 100));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Device Connection Status */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>ESP32 4G Dongle</span>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
            isOnline ? 'bg-emerald-950/70 border-emerald-800 text-emerald-400' : 'bg-rose-950/70 border-rose-800 text-rose-400'
          }`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="mt-4 flex items-center space-x-3">
          <div className={`p-3 rounded-xl ${isOnline ? 'bg-emerald-950/40 text-emerald-400' : 'bg-rose-950/40 text-rose-400'}`}>
            {isOnline ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
          </div>
          <div>
            <div className="text-lg font-bold text-slate-100 flex items-center space-x-1.5">
              <span>{isOnline ? 'Jio 4G Linked' : 'Signal Lost'}</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 font-mono">
              Last seen: {lastSeenText}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-between text-xs text-slate-400 font-mono">
          <span>RSSI: {connection.signalStrength ?? -68} dBm</span>
          <span>{connection.firmwareVersion || 'ESP32 v2.4'}</span>
        </div>
      </div>

      {/* 2. Actual Motor Status */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Motor Telemetry</span>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${motorInfo.badge}`}>
            {motorStatus}
          </span>
        </div>

        <div className="mt-4 flex items-center space-x-3">
          <div className={`p-3 rounded-xl ${
            motorStatus === 'ON' ? 'bg-emerald-950/40 text-emerald-400' : 'bg-slate-800/50 text-slate-400'
          }`}>
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <div className={`text-lg font-bold ${motorInfo.color}`}>
              {motorInfo.label}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {motorStatus === 'ON' ? 'Contactor closed & active' : 'Contactor open / disengaged'}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-between text-xs text-slate-400 font-mono">
          <span>Feedback: Current Sensor</span>
          <span>AC 230V</span>
        </div>
      </div>

      {/* 3. Pump Fault Protection */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Protection Logic</span>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
            fault ? 'bg-rose-950/70 border-rose-800 text-rose-300' : 'bg-emerald-950/70 border-emerald-800 text-emerald-400'
          }`}>
            {fault ? 'Trip' : 'Normal'}
          </span>
        </div>

        <div className="mt-4 flex items-center space-x-3">
          <div className={`p-3 rounded-xl ${fault ? 'bg-rose-950/50 text-rose-400' : 'bg-emerald-950/40 text-emerald-400'}`}>
            {fault ? <AlertTriangle className="w-6 h-6 animate-pulse" /> : <ShieldCheck className="w-6 h-6" />}
          </div>
          <div>
            <div className={`text-lg font-bold ${fault ? 'text-rose-300' : 'text-slate-100'}`}>
              {fault ? 'Trip Activated' : 'System Normal'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {fault ? faultType || 'Current Mismatch' : 'Thermal & dry-run clear'}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-between text-xs text-slate-400 font-mono">
          <span>Dry-run logic: Active</span>
          <span>Auto-cut: Yes</span>
        </div>
      </div>

      {/* 4. Current Sensor (Amperes) */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>Current Sensor (ACS712)</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400">
            {voltage} V AC
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-cyan-300 font-mono-digits">
              {current.toFixed(2)}
            </span>
            <span className="text-sm font-bold text-slate-400">Amperes (A)</span>
          </div>
        </div>

        {/* Current Visual Load Bar */}
        <div className="mt-3">
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                current > 6.5 ? 'bg-rose-500' : current > 0.5 ? 'bg-gradient-to-r from-cyan-500 to-emerald-400' : 'bg-slate-700'
              }`}
              style={{ width: `${currentPercent}%` }}
            ></div>
          </div>
        </div>

        <div className="mt-3 pt-2 flex justify-between text-[11px] text-slate-400 font-mono">
          <span>0.0 A</span>
          <span>Nominal: 4.2 A</span>
          <span>Max: 8.0 A</span>
        </div>
      </div>
    </div>
  );
};
