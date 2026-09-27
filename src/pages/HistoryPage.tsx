import React from 'react';
import { HistoryTable } from '../components/HistoryTable';
import { RuntimeSession, TelemetryLogEvent } from '../types/pump';
import { sessionService } from '../services/sessionService';
import { Clock, Calendar, CheckCircle2, AlertTriangle, Layers, Zap } from 'lucide-react';

interface HistoryPageProps {
  sessions: RuntimeSession[];
  logs: TelemetryLogEvent[];
  deviceId: string;
  activeStartedAt: number | null;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  sessions,
  logs,
  deviceId,
  activeStartedAt,
}) => {
  const todayTotalSec = sessionService.calculateTodayTotalSeconds(sessions, activeStartedAt);
  const totalDurationSec = sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
  const faultCount = sessions.filter((s) => s.faultOccurred).length;
  const avgSessionSec = sessions.length > 0 ? Math.round(totalDurationSec / sessions.length) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Total */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800">
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span>Today's Total Runtime</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-100 font-mono-digits mt-2">
            {sessionService.formatDuration(todayTotalSec)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Across {sessions.filter((s) => s.startedAt >= new Date().setHours(0, 0, 0, 0)).length} cycles today
          </div>
        </div>

        {/* Total Sessions */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800">
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Total Logged Cycles</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-100 font-mono-digits mt-2">
            {sessions.length} <span className="text-xs text-slate-400 font-sans font-normal">sessions</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Lifetime pump history
          </div>
        </div>

        {/* Average Duration */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800">
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Average Run Duration</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-100 font-mono-digits mt-2">
            {sessionService.formatDuration(avgSessionSec)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Per irrigation cycle
          </div>
        </div>

        {/* Fault Interventions */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800">
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium">
            <AlertTriangle className={`w-4 h-4 ${faultCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span>Protection Trips</span>
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono-digits mt-2 ${faultCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {faultCount} <span className="text-xs text-slate-400 font-sans font-normal">recorded</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {faultCount === 0 ? 'Optimal operation' : 'Safely interrupted'}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <HistoryTable
        sessions={sessions}
        logs={logs}
        deviceId={deviceId}
      />
    </div>
  );
};
