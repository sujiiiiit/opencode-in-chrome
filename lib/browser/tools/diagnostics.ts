// console, network, javascript (spec browser/page-diagnostics).
import type { DebuggerSessions } from '../debugger';
import type { Dialogs } from '../dialogs';
import type { ConsoleLog, NetworkLog } from '../diagnostics';
import type { TabScope } from '../tabs';
import { ToolError, untrusted, type ToolDef } from './registry';
import { requirePage, tabIdProperty } from './tabs';
import type { ComputerDeps } from './computer';

const JS_TIMEOUT_MS = 30_000;
const JS_MAX_CHARS = 20_000;

export type DiagnosticsDeps = {
  scope: TabScope;
  debuggers: DebuggerSessions;
  dialogs: Dialogs;
  console: ConsoleLog;
  network: NetworkLog;
  guard?: ComputerDeps['guard'];
};

type EvalResult = {
  result?: { type?: string; subtype?: string; value?: unknown; description?: string; unserializableValue?: string };
  exceptionDetails?: { text?: string; exception?: { description?: string } };
};

export function formatEvalResult(r: EvalResult, maxChars = JS_MAX_CHARS): string {
  const v = r.result;
  let text: string;
  if (!v || v.type === 'undefined') text = 'undefined';
  else if (v.unserializableValue) text = v.unserializableValue;
  else if (v.value !== undefined) text = JSON.stringify(v.value, null, 2) ?? String(v.value);
  else text = v.description ?? v.type ?? '';
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n[truncated at ${maxChars} of ${text.length} chars]` : text;
}

export function diagnosticsTools(deps: DiagnosticsDeps): ToolDef[] {
  const { scope } = deps;
  async function capture(tabId: number, action: unknown): Promise<void> {
    if (action === 'start') await deps.debuggers.startRecording(tabId);
    if (action === 'stop') deps.debuggers.stopRecording(tabId);
  }
  return [
    {
      name: 'console',
      description:
        "Read console messages captured while the debugger was attached. Use capture=start to record continuously and capture=stop to finish. " +
        'Always pass a regex pattern to filter, e.g. "error|warn" or "MyApp".',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: tabIdProperty,
          capture: { type: 'string', enum: ['start', 'stop'], description: 'Start or stop continuous console and network capture for this tab.' },
          pattern: { type: 'string', description: 'Regex the message must match (case-insensitive).' },
          onlyErrors: { type: 'boolean', description: 'Only errors and uncaught exceptions.' },
          limit: { type: 'integer', minimum: 1, maximum: 1000, description: 'Most recent N (default 100).' },
          clear: { type: 'boolean', description: 'Forget the returned messages afterwards.' },
        },
      },
      async handler(args, { sessionID }) {
        const tab = await requirePage(scope, sessionID, args.tabId);
        await capture(tab.id, args.capture);
        const text = deps.console.read(tab.id, {
          pattern: args.pattern as string | undefined,
          onlyErrors: args.onlyErrors === true,
          limit: args.limit as number | undefined,
          clear: args.clear === true,
        });
        return { text: [untrusted(text)], tabId: tab.id };
      },
    },
    {
      name: 'network',
      description:
        'List HTTP requests captured while the debugger was attached. Use capture=start to record continuously and capture=stop to finish. ' +
        'Filter with urlPattern (substring, e.g. "/api/"). Pass request_id to read one text response body.',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: tabIdProperty,
          capture: { type: 'string', enum: ['start', 'stop'], description: 'Start or stop continuous console and network capture for this tab.' },
          urlPattern: { type: 'string', description: 'Only URLs containing this.' },
          limit: { type: 'integer', minimum: 1, maximum: 500, description: 'Most recent N (default 100).' },
          clear: { type: 'boolean', description: 'Forget the returned requests afterwards.' },
          request_id: { type: 'string', description: 'A request id like r3: return its response body instead.' },
        },
      },
      async handler(args, { sessionID }) {
        const tab = await requirePage(scope, sessionID, args.tabId);
        await capture(tab.id, args.capture);
        if (typeof args.request_id === 'string' && args.request_id) {
          return { text: [untrusted(await deps.network.body(tab.id, args.request_id))], tabId: tab.id };
        }
        const text = deps.network.read(tab.id, {
          urlPattern: args.urlPattern as string | undefined,
          limit: args.limit as number | undefined,
          clear: args.clear === true,
        });
        return { text: [text], tabId: tab.id };
      },
    },
    {
      name: 'javascript',
      description:
        "Run JavaScript in the page's own context (works under strict CSP). REPL semantics: top-level await works and the last " +
        'expression is the result (as JSON). Use it to read page state; prefer computer/form_input for acting. Times out after 30 s.',
      inputSchema: {
        type: 'object',
        properties: { tabId: tabIdProperty, code: { type: 'string', description: 'The code; its last expression is returned.' } },
        required: ['code'],
      },
      async handler(args, { sessionID }) {
        const tab = await requirePage(scope, sessionID, args.tabId);
        deps.dialogs.assertClear(tab.id);
        const code = String(args.code);
        await deps.guard?.({ sessionID, tabId: tab.id, tool: 'javascript', action: 'run', summary: `Runs page JavaScript: ${code.slice(0, 80)}` });
        const result = await deps.debuggers
          .send<EvalResult>(
            tab.id,
            'Runtime.evaluate',
            { expression: code, replMode: true, awaitPromise: true, returnByValue: true, userGesture: true, generatePreview: false },
            { timeoutMs: JS_TIMEOUT_MS },
          )
          .catch((error: unknown) => {
            if (error instanceof ToolError && error.code === 'TIMEOUT') {
              throw new ToolError('TIMEOUT', 'The code did not finish within 30 s (an awaited promise may never settle).');
            }
            throw error;
          });
        if (result.exceptionDetails) {
          const message = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Error';
          throw new ToolError('INVALID_INPUT', `The code threw: ${message.split('\n').slice(0, 3).join('\n')}`);
        }
        return { text: [untrusted(formatEvalResult(result))], tabId: tab.id };
      },
    },
  ];
}
