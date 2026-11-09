export type BrowserEntry = { id: string; pid: number; pipe: string; token: string; kind: 'agent' | 'own'; label: string; startedAt: number };
export const HOST_NAME: string;
export const LEGACY_STATE_DIR: string;
export function stateDir(): string;
export function pipePath(id: string): string;
export function newBrowserId(): string;
export function writeBrowser(entry: BrowserEntry): void;
export function removeBrowser(id: string): void;
export function listBrowsers(): BrowserEntry[];
