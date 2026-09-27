import React, { useState } from 'react';
import {
  Sliders,
  Cpu,
  Database,
  Radio,
  RotateCcw,
  Check,
  ExternalLink,
  Shield,
  FileCode,
  AlertCircle,
} from 'lucide-react';
import { DeviceData } from '../types/pump';
import { deviceService } from '../services/deviceService';
import { mockStore } from '../services/mockStore';
import { isFirebaseConfigured, firebaseConfig } from '../services/firebase';

interface SettingsPageProps {
  device: DeviceData | null;
  onOpenSimulator: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  device,
  onOpenSimulator,
}) => {
  const [name, setName] = useState(device?.name || 'Field Borewell Pump #1');
  const [location, setLocation] = useState(device?.location || 'Plot 7 - Agricultural Sector');
  const [saved, setSaved] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (device) {
      await deviceService.updateDeviceMetadata(device.deviceId, name, location);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleResetData = () => {
    mockStore.resetMockData();
    setResetConfirm(true);
    setTimeout(() => setResetConfirm(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center space-x-2">
          <Sliders className="w-6 h-6 text-cyan-400" />
          <span>Device Configuration & ESP32 Specifications</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Borewell telemetry parameters, hardware pin mappings, and cloud sync paths.
        </p>
      </div>

      {/* Device Metadata Card */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
          <Radio className="w-4 h-4 text-cyan-400" />
          <span>Station Metadata</span>
        </h3>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Device Identifier (Firebase Path)
              </label>
              <input
                type="text"
                disabled
                value={device?.deviceId || 'Pump-001'}
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-mono text-cyan-400 cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-500">
                Matches ESP32 firmware <code>DEVICE_ID</code> in C++ sketch
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Station Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Field Location / Plot Description
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Metadata Saved!</span>
                </>
              ) : (
                <span>Save Metadata</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ESP32 Hardware Pinout Reference */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span>ESP32 Hardware Pin Connections</span>
        </h3>
        <p className="text-xs text-slate-400">
          Wire your ESP32, Jio 4G dongle, relay module, and ACS712 current sensor using this reference:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-cyan-400 font-bold font-sans text-xs">GPIO 26 &rarr; Relay IN</div>
            <div className="text-slate-400 mt-1 font-sans">
              Drives 5V Relay module which energizes the 230V/415V AC Contactor Coil (A1/A2).
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-cyan-400 font-bold font-sans text-xs">GPIO 34 (ADC1_CH6) &rarr; ACS712 OUT</div>
            <div className="text-slate-400 mt-1 font-sans">
              Measures RMS current through borehole phase wire. 0A = Motor Stopped / Trip.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-cyan-400 font-bold font-sans text-xs">Wi-Fi &rarr; Jio 4G Dongle Hotspot</div>
            <div className="text-slate-400 mt-1 font-sans">
              ESP32 automatically auto-reconnects to JioFi / Jio Dongle SSID on boot.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-cyan-400 font-bold font-sans text-xs">Heartbeat &rarr; 10s Timer</div>
            <div className="text-slate-400 mt-1 font-sans">
              Pushes timestamp to <code>/connection/lastSeen</code>. Dashboard triggers offline if &gt; 45s.
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Backend Status */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <span>Firebase Cloud Telemetry Backend</span>
        </h3>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-400">Firebase Backend Status:</span>
            <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
              isFirebaseConfigured
                ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                : 'bg-purple-950 border-purple-700 text-purple-300'
            }`}>
              {isFirebaseConfigured ? 'Connected to Project' : 'Local / Demo Mode Active'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-400">Realtime Database Path:</span>
            <code className="text-cyan-300 font-mono">/devices/{device?.deviceId || 'Pump-001'}</code>
          </div>

          {isFirebaseConfigured && firebaseConfig.projectId && (
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-400">Project ID:</span>
              <code className="text-slate-300 font-mono">{firebaseConfig.projectId}</code>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            onClick={onOpenSimulator}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-950/70 hover:bg-purple-900/80 border border-purple-700 text-purple-300 text-xs font-bold transition-all"
          >
            Launch ESP32 Simulator
          </button>

          <button
            onClick={handleResetData}
            className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>{resetConfirm ? 'Data Reset Complete!' : 'Reset Demo Sessions & Logs'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
