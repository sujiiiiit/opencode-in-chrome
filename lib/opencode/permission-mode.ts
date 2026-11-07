import { browser } from 'wxt/browser';

export type PermissionMode = 'manual' | 'auto';
export const PERMISSION_MODE_KEY = 'opencode.permission.mode';

export async function loadPermissionMode(): Promise<PermissionMode> {
  const value = await browser.storage.local.get(PERMISSION_MODE_KEY);
  return value[PERMISSION_MODE_KEY] === 'auto' ? 'auto' : 'manual';
}

export async function savePermissionMode(mode: PermissionMode): Promise<void> {
  await browser.storage.local.set({ [PERMISSION_MODE_KEY]: mode });
}
