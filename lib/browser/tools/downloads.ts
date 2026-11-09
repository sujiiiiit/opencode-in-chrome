// downloads (D2): the files this session's actions downloaded, and where they were saved.
import { describeDownload, type DownloadWatch } from '../downloads';
import { ToolError, type ToolDef } from './registry';

const MAX_WAIT_S = 60;

export function downloadsTool(watch: DownloadWatch): ToolDef {
  return {
    name: 'downloads',
    description:
      "List the files this session's actions downloaded: name, state, size and the path it was saved to. " +
      `wait: true waits (up to timeout seconds, default 30, at most ${MAX_WAIT_S}) for downloads still in progress. ` +
      "Only the agent's own downloads are shown.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'One download, e.g. d12.' },
        wait: { type: 'boolean', description: 'Wait for downloads in progress to finish.' },
        timeout: { type: 'number', minimum: 1, maximum: MAX_WAIT_S, description: 'Seconds to wait (default 30).' },
      },
    },
    async handler(args, { sessionID }) {
      const id = parseId(args.id);
      if (id !== undefined && !watch.owns(sessionID, id)) throw new ToolError('INVALID_INPUT', `No download ${String(args.id)} in this session.`);
      const waitMs = args.wait === true ? (typeof args.timeout === 'number' ? args.timeout : 30) * 1000 : 0;
      const items = await watch.list(sessionID, { id, waitMs });
      if (!items.length) return { text: ['No downloads in this session yet. A click that starts a download says so in its result.'] };
      return { text: items.map(describeDownload) };
    },
  };
}

function parseId(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const match = /^d?(\d+)$/.exec(String(value).trim());
  if (!match) throw new ToolError('INVALID_INPUT', `\`id\` looks like d12, got ${JSON.stringify(value)}.`);
  return Number(match[1]);
}
