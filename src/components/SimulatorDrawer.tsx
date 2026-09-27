import React, { useState } from 'react';
import {
  Cpu,
  X,
  Play,
  Square,
  AlertTriangle,
  WifiOff,
  Wifi,
  Sparkles,
  CheckCircle,
  HelpCircle,
  Info,
} from 'lucide-react';
import { simulationService } from '../services/simulationService';
import { DeviceStatus } from '../types/pump';

interface SimulatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  status: DeviceStatus;
  isOnline: boolean;
  deviceId: string;
}

export const SimulatorDrawer: React.FC<SimulatorDrawerProps> = ({
  isOpen,
  onClose,
  status,
  isOnline,
  deviceId,
}) => {
  const [isSimEnabled, setIsSimEnabled] = useState(simulationService.isEnabled());
  const [offlineSimulated, setOfflineSimulated] = useState(simulationService.isOfflineSimulated());

  if (!isOpen) return null;

  const handleToggleSimMode = () => {
    const next = simulationService.toggleSimulation();
    setIsSimEnabled(next);
  };

  const handleSimulateOn = () => {
    simulationService.processCommand(deviceId, {
      commandId: `sim_cmd_${Date.now()}`,
      command: 'PUMP_ON',
      createdAt: Date.now(),
      status: 'pending',
    });
  };

  const handleSimulateOff = () => {
    simulationService.processCommand(deviceId, {
      commandId: `sim_cmd_${Date.now()}`,
      command: 'PUMP_OFF',
      createdAt: Date.now(),
      status: 'pending',
    });
  };

  const handleSimulateFault = () => {
    simulationService.triggerFault(deviceId);
  };

  const handleToggleNetwork = () => {
    const next = !offlineSimulated;
    setOfflineSimulated(next);
    simulationService.setSimulatedOffline(next, deviceId);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-950/70 border border-purple-700/60 text-purple-400">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center space-x-1.5">
                <span>ESP32 Hardware Simulator</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 font-mono">
                  Virtual Node
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Hardware-free testing for physical contactor & current sensor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Simulator Controls Content */}
        <div className="p-5 space-y-6 flex-1">
          {/* Master Enable Toggle */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Simulation Engine
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {isSimEnabled
                  ? 'Active: Emulates ESP32 Wi-Fi & contactor'
                  : 'Disabled: Listening only to real ESP32'}
              </div>
            </div>
            <button
              onClick={handleToggleSimMode}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isSimEnabled
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isSimEnabled ? 'ENABLED' : 'PAUSED'}
            </button>
          </div>

          {/* Quick Simulation Trigger Buttons */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Simulate Physical Actions</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Simulate ON */}
              <button
                onClick={handleSimulateOn}
                disabled={status.motorStatus === 'ON'}
                className="flex items-center space-x-2 p-3 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-300 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Simulate Pump ON</span>
              </button>

              {/* Simulate OFF */}
              <button
                onClick={handleSimulateOff}
                disabled={status.motorStatus === 'OFF'}
                className="flex items-center space-x-2 p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Square className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Simulate Pump OFF</span>
              </button>

              {/* Simulate Current Fault */}
              <button
                onClick={handleSimulateFault}
                className="flex items-center space-x-2 p-3 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800 text-rose-300 text-xs font-bold transition-all"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Simulate Motor Fault</span>
              </button>

              {/* Simulate 4G Network Drop */}
              <button
                onClick={handleToggleNetwork}
                className={`flex items-center space-x-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                  offlineSimulated
                    ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                    : 'bg-amber-950/50 hover:bg-amber-900/60 border-amber-800 text-amber-300'
                }`}
              >
                {offlineSimulated ? (
                  <>
                    <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Restore Jio 4G Link</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Cut Jio 4G Signal</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Current State Inspector */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs font-mono">
            <div className="text-[11px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Virtual ESP32 Registers
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Motor State:</span>
              <span className={status.motorStatus === 'ON' ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                {status.motorStatus}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Current Sensor:</span>
              <span className="text-cyan-400 font-bold">{status.current.toFixed(2)} A</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>4G Dongle Link:</span>
              <span className={isOnline ? 'text-emerald-400' : 'text-rose-400'}>
                {isOnline ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Heartbeat Pulse:</span>
              <span className="text-slate-300">Every 10 seconds</span>
            </div>
          </div>

          {/* Educational Hardware Note */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-2">
            <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>How ESP32 Integration Works</span>
            </div>
            <p className="leading-relaxed">
              When your physical ESP32 is powered on and flashed with our firmware, it connects to your Jio 4G dongle Wi-Fi and connects directly to Firebase Realtime Database.
            </p>
            <p className="leading-relaxed">
              It listens to <code className="text-cyan-300">/devices/{deviceId}/command</code> and publishes motor status and sensor data back to <code className="text-cyan-300">/devices/{deviceId}/status</code>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
          >
            Close Simulator Panel
          </button>
        </div>
      </div>
    </div>
  );
};
