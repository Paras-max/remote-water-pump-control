import { RuntimeSession, TelemetryLogEvent } from '../types/pump';
import { isFirebaseConfigured, rtdb, firestore } from './firebase';
import { ref, onValue, off, query, limitToLast, orderByChild } from 'firebase/database';
import { collection, getDocs, orderBy, query as fsQuery, limit } from 'firebase/firestore';
import { mockStore } from './mockStore';

export class SessionService {
  /**
   * Subscribes to runtime sessions for a device.
   */
  subscribeToSessions(deviceId: string, onUpdate: (sessions: RuntimeSession[]) => void): () => void {
    if (isFirebaseConfigured && rtdb) {
      const sessionsRef = query(ref(rtdb, `devices/${deviceId}/sessions`), limitToLast(50));
      const unsubscribe = onValue(sessionsRef, (snapshot) => {
        if (snapshot.exists()) {
          const raw = snapshot.val();
          const list: RuntimeSession[] = Object.values(raw);
          // Sort descending by startedAt
          list.sort((a, b) => b.startedAt - a.startedAt);
          onUpdate(list);
        } else {
          onUpdate([]);
        }
      });

      return () => off(sessionsRef);
    } else {
      return mockStore.subscribeSessions(onUpdate);
    }
  }

  /**
   * Subscribes to system and telemetry logs.
   */
  subscribeToLogs(deviceId: string, onUpdate: (logs: TelemetryLogEvent[]) => void): () => void {
    if (isFirebaseConfigured && rtdb) {
      const logsRef = query(ref(rtdb, `devices/${deviceId}/logs`), limitToLast(100));
      const unsubscribe = onValue(logsRef, (snapshot) => {
        if (snapshot.exists()) {
          const raw = snapshot.val();
          const list: TelemetryLogEvent[] = Object.values(raw);
          list.sort((a, b) => b.timestamp - a.timestamp);
          onUpdate(list);
        } else {
          onUpdate([]);
        }
      });

      return () => off(logsRef);
    } else {
      return mockStore.subscribeLogs(onUpdate);
    }
  }

  /**
   * Calculates today's total runtime in seconds from completed sessions + active session (if any).
   */
  calculateTodayTotalSeconds(sessions: RuntimeSession[], activeStartedAt: number | null): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayStartMs = today.getTime();

    let totalSec = sessions
      .filter((s) => s.startedAt >= dayStartMs)
      .reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);

    if (activeStartedAt && activeStartedAt >= dayStartMs) {
      const activeSeconds = Math.max(0, Math.floor((Date.now() - activeStartedAt) / 1000));
      totalSec += activeSeconds;
    }

    return totalSec;
  }

  /**
   * Exports session history to CSV
   */
  exportToCSV(sessions: RuntimeSession[], deviceId: string) {
    const headers = ['Session ID', 'Start Time', 'End Time', 'Duration (s)', 'Duration (Formatted)', 'Average Current (A)', 'Stop Reason', 'Fault'];
    const rows = sessions.map((s) => [
      s.id,
      new Date(s.startedAt).toLocaleString(),
      new Date(s.stoppedAt).toLocaleString(),
      s.durationSeconds,
      this.formatDuration(s.durationSeconds),
      s.averageCurrent.toFixed(2),
      s.stopReason,
      s.faultOccurred ? 'YES' : 'NO',
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${deviceId}_pump_sessions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  formatDuration(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }
}

export const sessionService = new SessionService();
