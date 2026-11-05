// batch (spec browser/page-actions): several tool calls in one request, in order, stopping
// at the first error. Earlier results and images are kept; each item goes through its own
// tool's checks (including the safety layer), exactly as if called alone.
import { runTool, type ToolDef, type ToolOutput } from './registry';
import type { ClientMcpToolResult } from '@opencode/client/mcp';

const BATCH_MAX = 30;

export function batchTool(getTools: () => readonly ToolDef[], isStopped: () => boolean = () => false): ToolDef {
  return {
    name: 'batch',
    description:
      'Run several browser tool calls in one round trip, in order, stopping at the first error. Each item is {name, input} with the ' +
      'same input as the tool alone (for example navigate, then find, then computer left_click). Results and screenshots come back in order.',
    inputSchema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          minItems: 1,
          maxItems: BATCH_MAX,
          items: { type: 'object' },
          description: 'Items like {"name": "computer", "input": {"action": "left_click", "ref": "e4", "action_summary": "Opens the menu"}}.',
        },
      },
      required: ['actions'],
    },
    async handler(args, { sessionID }): Promise<ToolOutput> {
      const tools = new Map(getTools().map((t) => [t.name, t]));
      const items = args.actions as Array<{ name?: unknown; input?: unknown }>;
      const text: string[] = [];
      const images: NonNullable<ToolOutput['images']> = [];
      let completed = 0;
      for (const [index, item] of items.entries()) {
        if (isStopped()) {
          text.push(`Stopped by the user: ${completed} completed, ${items.length - index} not run.`);
          return { text, images };
        }
        const name = typeof item?.name === 'string' ? item.name : '';
        const result = await runBatchItem(tools, name, item?.input, sessionID);
        appendResult(result, index, name, text, images);
        if (result.isError) {
          const notRun = items.length - index - 1;
          text.push(`${completed} completed, ${notRun} not run (item ${index + 1} failed).`);
          return { text, images };
        }
        completed += 1;
      }
      text.push(`${completed} completed.`);
      return { text, images };
    },
  };
}

function appendResult(result: ClientMcpToolResult, index: number, name: string, text: string[], images: NonNullable<ToolOutput['images']>): void {
  for (const part of result.content) {
    if (part.type === 'text') text.push(`[${index + 1}. ${name || '?'}] ${part.text}`);
    else images.push({ data: part.data, mimeType: part.mimeType });
  }
}

function runBatchItem(tools: Map<string, ToolDef>, name: string, input: unknown, sessionID: string): Promise<ClientMcpToolResult> {
  const def = name === 'batch' ? undefined : tools.get(name);
  if (def) return runTool(def, (input ?? {}) as Record<string, unknown>, sessionID);
  const problem = name === 'batch' ? 'batch cannot be nested' : `unknown tool ${JSON.stringify(name)}`;
  return Promise.resolve({ content: [{ type: 'text', text: `INVALID_INPUT: ${problem}.` }], isError: true });
}
