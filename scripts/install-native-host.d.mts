export type Migration = { moved: string[]; left: string[] };
export function serverScript(dir?: string): string;
export function migrateLegacyState(options?: { from?: string; to?: string }): Migration;
export function launcherText(node: string, script: string, platform?: NodeJS.Platform): string;
export function installHost(extraIds?: string[]): { manifestFile: string; extensionIds: string[]; migration: Migration };
export function removeHost(): void;
export function describeMigration(migration: Migration): string;
