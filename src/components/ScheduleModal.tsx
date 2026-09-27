import React, { useState } from 'react';
import { Calendar, Clock, X, Check, AlertCircle } from 'lucide-react';
import { DeviceSchedule } from '../types/pump';
import { deviceService } from '../services/deviceService';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  currentSchedule?: DeviceSchedule;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  deviceId,
  currentSchedule,
}) => {
  const [enabled, setEnabled] = useState(currentSchedule?.enabled ?? false);
  const [startTime, setStartTime] = useState(currentSchedule?.startTime || '06:00');
  const [stopTime, setStopTime] = useState(currentSchedule?.stopTime || '07:00');
  const [selectedDays, setSelectedDays] = useState<number[]>(currentSchedule?.daysOfWeek || [1, 2, 3, 4, 5, 6]);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await deviceService.updateSchedule(deviceId, {
        enabled,
        startTime,
        stopTime,
        daysOfWeek: selectedDays,
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    } catch (e) {
      console.error('Failed to update schedule:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/70 text-cyan-400 border border-cyan-800/60">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Automated Pump Schedule</h3>
              <p className="text-xs text-slate-400">Autonomous timetable executed at the edge by ESP32</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Schedule vs Stopwatch Architectural Clarification */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            <strong>Architecture Guarantee:</strong> Schedules are evaluated on Firebase/ESP32. The dashboard stopwatch always measures <em>actual motor running time</em> verified by the current sensor, not scheduled duration.
          </span>
        </div>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div>
            <div className="text-sm font-bold text-slate-200">Enable Automated Schedule</div>
            <div className="text-xs text-slate-400">Pump activates automatically between designated hours</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
          </label>
        </div>

        {/* Time Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Start Time (ON)</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={!enabled}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-100 disabled:opacity-50 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-rose-400" />
              <span>Stop Time (OFF)</span>
            </label>
            <input
              type="time"
              value={stopTime}
              onChange={(e) => setStopTime(e.target.value)}
              disabled={!enabled}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-100 disabled:opacity-50 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Days of Week */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Active Days
          </label>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((day, idx) => {
              const active = selectedDays.includes(idx);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={!enabled}
                  onClick={() => toggleDay(idx)}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                    active && enabled
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                  } disabled:opacity-50`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-900/30 disabled:opacity-50"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Saved to Cloud!</span>
              </>
            ) : (
              <span>{saving ? 'Syncing...' : 'Save Schedule'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
