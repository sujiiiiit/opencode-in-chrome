import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { TextShimmer } from '@/components/ui/text-shimmer';
import type { ShellOutputLoader } from '@/lib/opencode/shell-output';

/** Text with a sweeping highlight while `active` (work in progress), plain once it is done. */
export function Shimmer({ active, children, className }: { active: boolean; children: string; className?: string }) {
  if (!active) return <span className={cn('min-w-0 truncate', className)}>{children}</span>;
  return (
    <TextShimmer as="span" className={cn('block min-w-0 truncate', className)}>
      {children}
    </TextShimmer>
  );
}

/** The current time, ticking every second while `active` (an elapsed-time label). */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * `active`, held true for `ms` after it turns false, so something switched off can finish
 * animating out (a closing panel, the last streamed words fading in).
 */
export function useLingering(active: boolean, ms: number): boolean {
  const [lingering, setLingering] = useState(active);
  useEffect(() => {
    if (active) {
      setLingering(true);
      return;
    }
    const timer = setTimeout(() => setLingering(false), ms);
    return () => clearTimeout(timer);
  }, [active, ms]);
  return active || lingering;
}

/** How shell tools read a background shell's live output (the open chat's ChatSession). */
const ShellOutputContext = createContext<ShellOutputLoader | null>(null);

export const ShellOutputProvider = ShellOutputContext.Provider;

export const useShellOutputLoader = () => useContext(ShellOutputContext);
