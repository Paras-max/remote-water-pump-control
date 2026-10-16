import { RuntimeSession, TelemetryLogEvent } from '../types/pump';
import { isFirebaseConfigured, rtdb } from './firebase';
import { ref, onValue, off, query, limitToLast, set } from 'firebase/database';
import { mockStore } from './mockStore';

export class SessionService {
  /**
   * Subscribes to runtime sessions for a device.
   */
  subscribeToSessions(deviceId: string, onUpdate: (sessions: RuntimeSession[]) => void): () => void {
    if (isFirebaseConfigured && rtdb) {
      const sessionsRef = query(ref(rtdb, `devices/${deviceId}/sessions`), limitToLast(100));
      const unsubscribe = onValue(
        sessionsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const raw = snapshot.val();
            const list: RuntimeSession[] = Object.values(raw);
            // Sort descending by startedAt
            list.sort((a, b) => b.startedAt - a.startedAt);
            onUpdate(list);
          } else {
            onUpdate([]);
          }
        },
        (error) => {
          console.error('[Firebase] Error fetching sessions:', error);
          onUpdate([]);
        }
      );

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
      const unsubscribe = onValue(
        logsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const raw = snapshot.val();
            const list: TelemetryLogEvent[] = Object.values(raw);
            list.sort((a, b) => b.timestamp - a.timestamp);
            onUpdate(list);
          } else {
            onUpdate([]);
          }
        },
        (error) => {
          console.error('[Firebase] Error fetching logs:', error);
          onUpdate([]);
        }
      );

      return () => off(logsRef);
    } else {
      return mockStore.subscribeLogs(onUpdate);
    }
  }

  /**
   * Normalizes any epoch timestamp (handles seconds vs milliseconds).
   */
  normalizeTimestamp(ts: number | null | undefined): number | null {
    if (ts === null || ts === undefined) return null;
    let val = Number(ts);
    if (isNaN(val) || val <= 0) return null;
    if (val < 10000000000) {
      val = val * 1000;
    }
    // Reject dates before year 2020
    if (val < 1577836800000) return null;
    return val;
  }

  /**
   * Calculates today's total runtime in seconds from completed sessions + active session (if confirmed).
   * Correctly splits sessions across midnight: only the portion occurring within today's calendar boundaries
   * is counted toward today's total.
   */
  calculateTodayTotalSeconds(
    sessions: RuntimeSession[],
    activeStartedAt: number | null,
    isMotorConfirmedRunning: boolean = false,
    nowMs: number = Date.now()
  ): number {
    const today = new Date(nowMs);
    today.setHours(0, 0, 0, 0);
    const dayStartMs = today.getTime();
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;

    let totalSec = 0;

    // 1. Process completed sessions
    for (const session of sessions) {
      if (!session) continue;
      const start = this.normalizeTimestamp(session.startedAt);
      const stop = this.normalizeTimestamp(session.stoppedAt);

      if (!start || !stop || stop <= start) continue;

      // Calculate intersection between session [start, stop] and [dayStartMs, dayEndMs]
      const overlapStart = Math.max(start, dayStartMs);
      const overlapEnd = Math.min(stop, dayEndMs);

      if (overlapEnd > overlapStart) {
        totalSec += Math.floor((overlapEnd - overlapStart) / 1000);
      }
    }

    // 2. Process active session (only if motor is actively confirmed ON)
    if (isMotorConfirmedRunning && activeStartedAt) {
      const activeStart = this.normalizeTimestamp(activeStartedAt);
      if (activeStart && activeStart <= nowMs) {
        const overlapStart = Math.max(activeStart, dayStartMs);
        const overlapEnd = Math.min(nowMs, dayEndMs);
        if (overlapEnd > overlapStart) {
          totalSec += Math.floor((overlapEnd - overlapStart) / 1000);
        }
      }
    }

    return totalSec;
  }

  /**
   * Records a completed pump session in Firebase RTDB or local store.
   */
  async recordSession(deviceId: string, session: RuntimeSession): Promise<void> {
    if (isFirebaseConfigured && rtdb) {
      try {
        const sessionRef = ref(rtdb, `devices/${deviceId}/sessions/${session.id}`);
        await set(sessionRef, session);
      } catch (err) {
        console.error('[Firebase] Failed to write session history:', err);
      }
    } else {
      mockStore.addSession(session);
    }
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
      (s.averageCurrent || 0).toFixed(2),
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
    const total = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
}

export const sessionService = new SessionService();
