import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, Send, Cpu, Zap, WifiOff } from 'lucide-react';
import { CommandPipelinePhase } from '../hooks/usePumpDevice';

interface CommandFeedbackProps {
  phase: CommandPipelinePhase;
  message: string;
  isOnline: boolean;
}

export const CommandFeedback: React.FC<CommandFeedbackProps> = ({
  phase,
  message,
  isOnline,
}) => {
  if (phase === 'idle' && isOnline) {
    return null;
  }

  // Warning when device is offline
  if (!isOnline && phase === 'idle') {
    return (
      <div className="rounded-xl p-3.5 bg-amber-950/60 border border-amber-800/60 text-amber-200 flex items-center justify-between gap-3 text-xs sm:text-sm animate-pulse">
        <div className="flex items-center space-x-2.5">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Device Offline:</strong> ESP32 heartbeat overdue. Commands may remain pending in cloud queue until 4G dongle reconnects.
          </span>
        </div>
      </div>
    );
  }

  // Active command pipeline steps
  const steps = [
    { key: 'sending', label: 'Cloud Queue', icon: Send },
    { key: 'sent', label: 'Firebase RTDB', icon: Clock },
    { key: 'acknowledged', label: 'ESP32 Ack', icon: Cpu },
    { key: 'motor_on', label: 'Motor Verified', icon: Zap },
  ];

  const getStepStatus = (stepKey: string) => {
    if (phase === 'failed' || phase === 'timeout') return 'error';

    const order = ['sending', 'sent', 'acknowledged', 'motor_on', 'motor_off'];
    const currentIndex = order.indexOf(phase);
    const stepIndex = order.indexOf(stepKey);

    if (currentIndex >= stepIndex) return 'completed';
    return 'pending';
  };

  return (
    <div
      className={`rounded-2xl p-4 border transition-all ${
        phase === 'timeout' || phase === 'failed'
          ? 'bg-rose-950/60 border-rose-800/80 text-rose-200'
          : phase === 'motor_on'
          ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
          : 'bg-slate-900/90 border-cyan-800/50 text-cyan-200'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          {phase === 'timeout' || phase === 'failed' ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 animate-bounce" />
          ) : phase === 'motor_on' || phase === 'motor_off' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <Cpu className="w-5 h-5 text-cyan-400 shrink-0 animate-spin" />
          )}

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Command Execution Pipeline
            </div>
            <div className="text-sm font-bold text-slate-100">{message}</div>
          </div>
        </div>

        {/* Mini Step Pipeline Indicator */}
        <div className="flex items-center space-x-1.5 self-start sm:self-auto">
          {steps.map((step, idx) => {
            const status = getStepStatus(step.key);
            return (
              <React.Fragment key={step.key}>
                <div
                  className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[10px] font-mono font-medium ${
                    status === 'completed'
                      ? 'bg-emerald-900/70 text-emerald-300 border border-emerald-700/60'
                      : status === 'error'
                      ? 'bg-rose-950/70 text-rose-400 border border-rose-800/60'
                      : 'bg-slate-800/80 text-slate-400 border border-slate-700'
                  }`}
                >
                  <step.icon className="w-3 h-3" />
                  <span className="hidden xs:inline">{step.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <span className="text-slate-600 text-xs">→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
