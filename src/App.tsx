import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { SimulatorDrawer } from './components/SimulatorDrawer';
import { ScheduleModal } from './components/ScheduleModal';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './hooks/useAuth';
import { usePumpDevice } from './hooks/usePumpDevice';
import { sessionService } from './services/sessionService';
import { simulationService } from './services/simulationService';
import { RuntimeSession, TelemetryLogEvent } from './types/pump';
import { Activity, ShieldCheck, Cpu, Wifi, ExternalLink } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'schedule' | 'settings'>('dashboard');
  const [deviceId] = useState<string>('Pump-001');

  // Modals & Drawers state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isSimulationMode, setIsSimulationMode] = useState(simulationService.isEnabled());

  // Sessions & Logs
  const [sessions, setSessions] = useState<RuntimeSession[]>([]);
  const [logs, setLogs] = useState<TelemetryLogEvent[]>([]);

  // Auth Hook
  const { user, logout } = useAuth();

  // Pump Device Telemetry Hook
  const {
    device,
    loading,
    isOnline,
    lastSeenText,
    pipelinePhase,
    pipelineMessage,
    turnOnPump,
    turnOffPump,
    emergencyStop,
    resetFault,
    pendingAction,
  } = usePumpDevice(deviceId);

  // Subscribe to sessions and logs
  useEffect(() => {
    const unsubSessions = sessionService.subscribeToSessions(deviceId, (s) => setSessions(s));
    const unsubLogs = sessionService.subscribeToLogs(deviceId, (l) => setLogs(l));

    return () => {
      unsubSessions();
      unsubLogs();
    };
  }, [deviceId]);

  const handleTabChange = (tab: 'dashboard' | 'history' | 'schedule' | 'settings') => {
    if (tab === 'schedule') {
      setIsScheduleOpen(true);
    } else {
      setActiveTab(tab);
    }
  };

  const handleToggleSimulator = () => {
    setIsSimulatorOpen(true);
    setIsSimulationMode(simulationService.isEnabled());
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        isOnline={isOnline}
        lastSeenText={lastSeenText}
        isSimulationMode={isSimulationMode}
        onToggleSimulator={handleToggleSimulator}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={logout}
        deviceId={deviceId}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {loading && !device ? (
          <div className="flex flex-col items-center justify-center min-h-[55vh] space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-cyan-400 animate-spin"></div>
              <Activity className="w-6 h-6 text-cyan-400 absolute inset-0 m-auto" />
            </div>
            <p className="text-xs font-mono text-slate-400 tracking-wider">
              CONNECTING TO FIREBASE TELEMETRY BUS...
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardPage
                device={device}
                isOnline={isOnline}
                lastSeenText={lastSeenText}
                pipelinePhase={pipelinePhase}
                pipelineMessage={pipelineMessage}
                pendingAction={pendingAction}
                onTurnOn={turnOnPump}
                onTurnOff={turnOffPump}
                onEmergencyOff={emergencyStop}
                onResetFault={resetFault}
                onOpenSimulator={() => setIsSimulatorOpen(true)}
              />
            )}

            {activeTab === 'history' && (
              <HistoryPage
                sessions={sessions}
                logs={logs}
                deviceId={deviceId}
                activeStartedAt={device?.status.motorStartedAt || null}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPage
                device={device}
                onOpenSimulator={() => setIsSimulatorOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/90 py-6 px-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
            <span className="font-semibold text-slate-300">AquaFlow 4G Telemetry Node</span>
            <span>&bull;</span>
            <span>ESP32 + Jio 4G Hotspot</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="font-mono text-[11px] text-slate-400">RTDB: /devices/{deviceId}</span>
            <span>&bull;</span>
            <span className="text-emerald-400 font-medium">Contactor Protection: ACS712</span>
          </div>
        </div>
      </footer>

      {/* Virtual ESP32 Hardware Simulator Drawer */}
      {device && (
        <SimulatorDrawer
          isOpen={isSimulatorOpen}
          onClose={() => setIsSimulatorOpen(false)}
          status={device.status}
          isOnline={isOnline}
          deviceId={deviceId}
        />
      )}

      {/* Automated Pump Schedule Modal */}
      <ScheduleModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        deviceId={deviceId}
        currentSchedule={device?.schedule}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
}

export default App;
