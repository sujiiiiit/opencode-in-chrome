// gif: record the session's browser actions and export them as an animated GIF download.
import type { GifRecorder } from '../recorder';
import type { TabScope } from '../tabs';
import { ToolError, type ToolDef } from './registry';
import { requirePage, tabIdProperty } from './tabs';

export function gifTool(scope: TabScope, recorder: GifRecorder): ToolDef {
  return {
    name: 'gif',
    description:
      'Record a GIF of browser actions: start_recording, act (each click, type or navigation adds a frame), stop_recording, then export ' +
      '(saved as a download with click markers, action labels and a progress bar). clear discards the frames.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start_recording', 'stop_recording', 'export', 'clear'] },
        tabId: tabIdProperty,
        filename: { type: 'string', description: 'For export, e.g. checkout.gif (default recording-<time>.gif).' },
        options: {
          type: 'object',
          description: 'For export: showClickIndicators, showActionLabels, showProgressBar (booleans, default true).',
        },
      },
      required: ['action'],
    },
    async handler(args, { sessionID }) {
      const action = String(args.action);
      if (action === 'clear') {
        recorder.clear(sessionID);
        return { text: ['Discarded the recorded frames.'] };
      }
      if (action === 'export') {
        return exportRecording(recorder, sessionID, args);
      }
      return recordingAction(scope, recorder, sessionID, action, args.tabId);
    },
  };
}

async function recordingAction(scope: TabScope, recorder: GifRecorder, sessionID: string, action: string, tabId: unknown) {
  const tab = await requirePage(scope, sessionID, tabId);
  if (action === 'start_recording') {
    await recorder.start(sessionID, tab.id);
    return { text: ['Recording. Each action adds a frame; stop_recording, then export.'], tabId: tab.id };
  }
  if (action === 'stop_recording') return stopRecording(recorder, sessionID, tab.id);
  throw new ToolError('INVALID_INPUT', `Unknown gif action ${JSON.stringify(action)}.`);
}

async function exportRecording(recorder: GifRecorder, sessionID: string, args: Record<string, unknown>) {
  const filename = typeof args.filename === 'string' && args.filename ? args.filename : `recording-${Date.now()}.gif`;
  const out = await recorder.export(sessionID, filename, (args.options ?? {}) as Record<string, boolean>);
  return { text: [`Exported ${out.frames} frame(s) to the download ${JSON.stringify(out.filename)} (${Math.round(out.bytes / 1024)} kB).`] };
}

async function stopRecording(recorder: GifRecorder, sessionID: string, tabId: number) {
  if (!recorder.isRecording(sessionID)) throw new ToolError('INVALID_INPUT', 'Not recording. Use start_recording first.');
  await recorder.stop(sessionID, tabId);
  return { text: [`Stopped recording with ${recorder.frameCount(sessionID)} frame(s). Use export to save the GIF.`], tabId };
}
