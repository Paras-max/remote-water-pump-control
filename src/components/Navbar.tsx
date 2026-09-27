import React from 'react';
import {
  Activity,
  Wifi,
  WifiOff,
  Cpu,
  LogOut,
  User,
  Sliders,
  Calendar,
  History,
  LayoutDashboard,
  ShieldAlert,
} from 'lucide-react';
import { AuthUser } from '../types/pump';
import { isFirebaseConfigured } from '../services/firebase';

interface NavbarProps {
  activeTab: 'dashboard' | 'history' | 'schedule' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'history' | 'schedule' | 'settings') => void;
  isOnline: boolean;
  lastSeenText: string;
  isSimulationMode: boolean;
  onToggleSimulator: () => void;
  user: AuthUser | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  deviceId: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isOnline,
  lastSeenText,
  isSimulationMode,
  onToggleSimulator,
  user,
  onOpenAuth,
  onLogout,
  deviceId,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Device Badge */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-200 bg-clip-text text-transparent">
                  AquaFlow 4G
                </span>
                <span className="hidden xs:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wide bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                  {deviceId}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Remote Water Pump Telemetry System
              </p>
            </div>
          </div>

          {/* Navigation Links for Desktop */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'schedule'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Schedule</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </nav>

          {/* Status & Action Badges */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Live Connection Pill */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isOnline
                  ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
                  : 'bg-rose-950/60 border-rose-800/60 text-rose-400 animate-pulse'
              }`}
              title={`Heartbeat: ${lastSeenText}`}
            >
              {isOnline ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Offline</span>
                </>
              )}
            </div>

            {/* Virtual Hardware Simulator Drawer Button */}
            <button
              onClick={onToggleSimulator}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                isSimulationMode
                  ? 'bg-purple-950/70 border-purple-700/70 text-purple-300 shadow-sm shadow-purple-900/30'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Open ESP32 Hardware Simulator"
            >
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">ESP32 Sim</span>
              {isSimulationMode && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
              )}
            </button>

            {/* User Profile / Auth */}
            {user ? (
              <div className="flex items-center space-x-2 pl-1">
                <div
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-cyan-300"
                  title={user.email || 'Operator'}
                >
                  {user.displayName?.[0]?.toUpperCase() || 'O'}
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition-all"
              >
                <User className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation bar at bottom or under header */}
      <div className="flex md:hidden border-t border-slate-800/60 bg-slate-950/95 px-2 py-1.5 justify-around">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'dashboard' ? 'text-cyan-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span>Dashboard</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'history' ? 'text-cyan-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <History className="w-4 h-4 mb-0.5" />
          <span>History</span>
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'schedule' ? 'text-cyan-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Calendar className="w-4 h-4 mb-0.5" />
          <span>Schedule</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'settings' ? 'text-cyan-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Sliders className="w-4 h-4 mb-0.5" />
          <span>Settings</span>
        </button>
      </div>
    </header>
  );
};
