import { useEffect, useState } from 'react';

interface TributeRevealProgressBarProps {
  deadline: number;
  durationMs: number;
}

export function getTributeRevealProgress(deadline: number, durationMs: number, now: number): number {
  if (durationMs <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, ((deadline - now) / durationMs) * 100));
}

export function TributeRevealProgressBar({ deadline, durationMs }: TributeRevealProgressBarProps) {
  const [now, setNow] = useState(() => Date.now());
  const progress = getTributeRevealProgress(deadline, durationMs, now);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [deadline]);

  return (
    <div
      aria-label="贡牌公开剩余进度"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(progress)}
      className="tribute-reveal-progress"
      role="progressbar"
    >
      <span style={{ width: `${progress}%` }} />
    </div>
  );
}
