// Downloads the agent starts (D2 in docs/browser-automation-coverage.md). Chrome does not say
// which tab started a download, so a download created while a session's action runs belongs
// to that session. Only those are ever shown: the user's other downloads stay private.

export type DownloadItem = {
  id: number;
  url: string;
  finalUrl?: string;
  filename: string;
  state: 'in_progress' | 'interrupted' | 'complete';
  bytesReceived: number;
  totalBytes: number;
  error?: string;
  mime?: string;
};

export type DownloadApi = {
  onCreated(cb: (item: DownloadItem) => void): void;
  search(id: number): Promise<DownloadItem | undefined>;
  /** Starts a download of `url` (a data URL for files the extension makes) as `filename` under Downloads. */
  download?(url: string, filename: string): Promise<number>;
};

const label = (id: number) => `d${id}`;
const baseName = (path: string) => path.split(/[\\/]/).pop() || path;

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** One line for the model: `d12 report.csv — complete, 12.3 KB, saved to C:\…\report.csv`. */
export function describeDownload(d: DownloadItem): string {
  const name = baseName(d.filename) || baseName(new URL(d.finalUrl || d.url, 'https://x/').pathname) || 'file';
  if (d.state === 'complete') return `${label(d.id)} ${name} — complete, ${size(d.bytesReceived || d.totalBytes)}, saved to ${d.filename}`;
  if (d.state === 'interrupted') return `${label(d.id)} ${name} — failed (${d.error ?? 'interrupted'})`;
  const of = d.totalBytes > 0 ? ` of ${size(d.totalBytes)}` : '';
  return `${label(d.id)} ${name} — downloading, ${size(d.bytesReceived)}${of}`;
}

export class DownloadWatch {
  /** Downloads created recently, with when: an action claims the ones created while it ran. */
  private readonly recent: Array<{ id: number; at: number }> = [];
  private readonly bySession = new Map<string, number[]>();
  /** Files the extension saved itself: never claimed by an action. */
  private readonly own = new Set<number>();

  constructor(
    private readonly api: DownloadApi,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {
    api.onCreated((item) => {
      this.recent.push({ id: item.id, at: this.now() });
      if (this.recent.length > 50) this.recent.shift();
    });
  }

  /** Gives the session the downloads created since `since`; returns their result lines. */
  async claimSince(sessionID: string, since: number): Promise<string[]> {
    const ids = this.recent.filter((r) => r.at >= since && !this.own.has(r.id)).map((r) => r.id);
    if (!ids.length) return [];
    for (const r of [...this.recent]) if (ids.includes(r.id)) this.recent.splice(this.recent.indexOf(r), 1);
    this.bySession.set(sessionID, [...(this.bySession.get(sessionID) ?? []), ...ids]);
    const items = await Promise.all(ids.map((id) => this.api.search(id)));
    return items.filter((d): d is DownloadItem => !!d).map((d) => `Download started: ${describeDownload(d)}. Call downloads with wait: true for where it was saved.`);
  }

  /** The session's downloads, newest first; with `wait`, after the in-progress ones end (or the time is up). */
  async list(sessionID: string, options: { id?: number; waitMs?: number } = {}): Promise<DownloadItem[]> {
    const ids = (this.bySession.get(sessionID) ?? []).filter((id) => options.id === undefined || id === options.id).reverse();
    const deadline = this.now() + (options.waitMs ?? 0);
    for (;;) {
      const items = (await Promise.all(ids.map((id) => this.api.search(id)))).filter((d): d is DownloadItem => !!d);
      if (!items.some((d) => d.state === 'in_progress') || this.now() >= deadline) return items;
      await this.sleep(500);
    }
  }

  /** Saves a file the extension made (P5: a screenshot) and returns its full path once written. */
  async save(url: string, filename: string, timeoutMs = 10_000): Promise<string> {
    if (!this.api.download) throw new Error('downloads are not available');
    const id = await this.api.download(url, filename);
    this.own.add(id);
    const deadline = this.now() + timeoutMs;
    for (;;) {
      const item = await this.api.search(id);
      if (item?.state === 'complete') return item.filename;
      if (item?.state === 'interrupted') throw new Error(`could not save ${filename}: ${item.error ?? 'interrupted'}`);
      if (this.now() >= deadline) return `Downloads/${filename} (still being written)`;
      await this.sleep(100);
    }
  }

  owns(sessionID: string, id: number): boolean {
    return !!this.bySession.get(sessionID)?.includes(id);
  }
}
