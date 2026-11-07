import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { loadPermissionMode, PERMISSION_MODE_KEY, type PermissionMode } from './permission-mode';

/** Follows the shared local setting, including changes made in another extension view. */
export function usePermissionMode(): PermissionMode | null {
  const [mode, setMode] = useState<PermissionMode | null>(null);
  useEffect(() => {
    let active = true;
    let changed = false;
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local' || !changes[PERMISSION_MODE_KEY]) return;
      changed = true;
      setMode(changes[PERMISSION_MODE_KEY].newValue === 'auto' ? 'auto' : 'manual');
    };
    browser.storage.onChanged.addListener(onChanged);
    void loadPermissionMode().then((value) => { if (active && !changed) setMode(value); }, () => { if (active && !changed) setMode('manual'); });
    return () => { active = false; browser.storage.onChanged.removeListener(onChanged); };
  }, []);
  return mode;
}
