import React from 'react';
import { PumpStatusCard } from '../components/PumpStatusCard';
import { PumpControls } from '../components/PumpControls';
import { TelemetryGrid } from '../components/TelemetryGrid';
import { CommandFeedback } from '../components/CommandFeedback';
import { DeviceData } from '../types/pump';
import { CommandPipelinePhase } from '../hooks/usePumpDevice';
import { ShieldCheck, HardHat, Info } from 'lucide-react';

interface DashboardPageProps {
  device: DeviceData | null;
  isOnline: boolean;
  lastSeenText: string;
  pipelinePhase: CommandPipelinePhase;
  pipelineMessage: string;
  pendingAction: boolean;
  onTurnOn: () => void;
  onTurnOff: () => void;
  onEmergencyOff: () => void;
  onResetFault: () => void;
  onOpenSimulator: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  device,
  isOnline,
  lastSeenText,
  pipelinePhase,
  pipelineMessage,
  pendingAction,
  onTurnOn,
  onTurnOff,
  onEmergencyOff,
  onResetFault,
  onOpenSimulator,
}) => {
  if (!device) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Real-time Command Feedback Banner */}
      <CommandFeedback
        phase={pipelinePhase}
        message={pipelineMessage}
        isOnline={isOnline}
      />

      {/* Hero Pump Status Card with Stopwatch */}
      <PumpStatusCard
        status={device.status}
        isOnline={isOnline}
        onResetFault={onResetFault}
      />

      {/* Industrial Pump Controls (ON / OFF / EMERGENCY OFF) */}
      <PumpControls
        motorStatus={device.status.motorStatus}
        isOnline={isOnline}
        pendingAction={pendingAction}
        onTurnOn={onTurnOn}
        onTurnOff={onTurnOff}
        onEmergencyOff={onEmergencyOff}
      />

      {/* 4-Card Telemetry Grid */}
      <TelemetryGrid
        status={device.status}
        connection={device.connection}
        isOnline={isOnline}
        lastSeenText={lastSeenText}
      />

      {/* Engineering Architecture Callout */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-cyan-950/70 text-cyan-400 border border-cyan-800/60 shrink-0">
            <HardHat className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-200">
              Hardware-Ready ESP32 Architecture
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Dashboard commands are committed to Firebase RTDB under <code className="text-cyan-300 font-mono">/devices/{device.deviceId}/command</code>. The ESP32 confirms contactor engagement through its ACS712 current sensor.
            </div>
          </div>
        </div>

        <button
          onClick={onOpenSimulator}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all shrink-0"
        >
          Open Hardware Simulator
        </button>
      </div>
    </div>
  );
};
