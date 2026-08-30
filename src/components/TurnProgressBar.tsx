import { useEffect, useState } from 'react';
import { getTurnDurationMs } from '../game/rules/timing';
import type { TimerChoice } from '../game/types';

interface TurnProgressBarProps {
  timer: TimerChoice;
  turnDeadline: number | null;
}

export function getTurnProgress(
  timer: TimerChoice,
  turnDeadline: number | null,
  now: number,
): number | null {
  const duration = getTurnDurationMs(timer);
  if (duration === null || turnDeadline === null) {
    return null;
  }
  return Math.min(100, Math.max(0, ((turnDeadline - now) / duration) * 100));
}

export function TurnProgressBar({ timer, turnDeadline }: TurnProgressBarProps) {
  const [now, setNow] = useState(() => Date.now());
  const progress = getTurnProgress(timer, turnDeadline, now);

  useEffect(() => {
    if (turnDeadline === null || timer === '不限时') {
      return undefined;
    }
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [timer, turnDeadline]);

  if (progress === null) {
    return null;
  }

  return (
    <div
      aria-label="本回合剩余时间进度"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(progress)}
      className="turn-progress"
      role="progressbar"
    >
      <span style={{ width: `${progress}%` }} />
    </div>
  );
}
