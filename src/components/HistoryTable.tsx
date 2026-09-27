import React, { useState } from 'react';
import {
  Download,
  Clock,
  Zap,
  AlertTriangle,
  Play,
  Square,
  ShieldAlert,
  Search,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { RuntimeSession, TelemetryLogEvent } from '../types/pump';
import { sessionService } from '../services/sessionService';

interface HistoryTableProps {
  sessions: RuntimeSession[];
  logs: TelemetryLogEvent[];
  deviceId: string;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({
  sessions,
  logs,
  deviceId,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'sessions' | 'logs'>('sessions');
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilter, setLogFilter] = useState<'ALL' | 'COMMAND' | 'STATE_CHANGE' | 'FAULT' | 'CONNECTION'>('ALL');

  const handleExportCSV = () => {
    sessionService.exportToCSV(sessions, deviceId);
  };

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const dateStr = new Date(s.startedAt).toLocaleString().toLowerCase();
    return s.id.toLowerCase().includes(q) || dateStr.includes(q) || s.stopReason.toLowerCase().includes(q);
  });

  const filteredLogs = logs.filter((l) => {
    if (logFilter !== 'ALL' && l.type !== logFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return l.message.toLowerCase().includes(q) || l.type.toLowerCase().includes(q);
  });

  return (
    <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-6">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <span>Operation Records & Telemetry Logs</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Historical motor running sessions, durations, contactor actions, and fault records.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {/* Subtab Switcher */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveSubTab('sessions')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === 'sessions'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sessions ({sessions.length})
            </button>
            <button
              onClick={() => setActiveSubTab('logs')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === 'logs'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Event Logs ({logs.length})
            </button>
          </div>

          {/* Export CSV Button */}
          {activeSubTab === 'sessions' && (
            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all shadow-sm"
              title="Download CSV report"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={activeSubTab === 'sessions' ? 'Search by date or ID...' : 'Filter logs...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {activeSubTab === 'logs' && (
          <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
            <span className="text-slate-500 text-xs flex items-center space-x-1 pr-1">
              <Filter className="w-3 h-3" />
            </span>
            {(['ALL', 'COMMAND', 'STATE_CHANGE', 'FAULT', 'CONNECTION'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setLogFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  logFilter === cat
                    ? 'bg-slate-700 text-cyan-300 font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SESSIONS TABLE */}
      {activeSubTab === 'sessions' && (
        <div className="overflow-x-auto">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No runtime sessions recorded yet. Turn the pump ON and then OFF to register your first session.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Session</th>
                  <th className="py-3 px-3">Start Time (ON)</th>
                  <th className="py-3 px-3">Stop Time (OFF)</th>
                  <th className="py-3 px-3">Total Runtime</th>
                  <th className="py-3 px-3">Avg Current</th>
                  <th className="py-3 px-3">Stop Reason</th>
                  <th className="py-3 px-3 text-right">Protection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredSessions.map((session, index) => (
                  <tr key={session.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-3 font-mono text-cyan-400 font-medium">
                      #{sessions.length - index}
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-mono">
                      <div className="flex items-center space-x-1.5">
                        <Play className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>{new Date(session.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-mono">
                      <div className="flex items-center space-x-1.5">
                        <Square className="w-3 h-3 text-rose-400 shrink-0" />
                        <span>{new Date(session.stoppedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-100 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800">
                        {sessionService.formatDuration(session.durationSeconds)}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      <span className="flex items-center space-x-1">
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>{session.averageCurrent.toFixed(1)} A</span>
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          session.stopReason === 'EMERGENCY_OFF'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : session.stopReason === 'FAULT_TRIP'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-850 text-slate-300'
                        }`}
                      >
                        {session.stopReason.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {session.faultOccurred ? (
                        <span className="inline-flex items-center space-x-1 text-rose-400 text-[11px] font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Trip</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-emerald-400 text-[11px] font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Normal</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* EVENT LOGS */}
      {activeSubTab === 'logs' && (
        <div className="space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No matching log events recorded.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors text-xs"
              >
                <div className="flex items-start space-x-3">
                  <div
                    className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                      log.level === 'error'
                        ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                        : log.level === 'warning'
                        ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                        : log.level === 'success'
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                        : 'bg-slate-800 text-cyan-400 border border-slate-700'
                    }`}
                  >
                    {log.type === 'FAULT' ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : log.type === 'COMMAND' ? (
                      <Zap className="w-4 h-4" />
                    ) : log.type === 'STATE_CHANGE' ? (
                      <Clock className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">{log.message}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Type: <span className="text-slate-400">{log.type}</span> &bull; Device: <span className="text-slate-400">{log.deviceId}</span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-mono shrink-0 pl-2">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
