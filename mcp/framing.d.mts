// Types for framing.mjs (the MCP host and server are plain Node scripts, so they run without a build).
import type { Readable, Writable } from 'node:stream';

export function readNative(stream: Readable, onMessage: (message: Record<string, unknown>) => void): void;
export function writeNative(stream: Writable, message: unknown): void;
export function readLines(stream: Readable, onMessage: (message: Record<string, unknown>) => void): void;
export function writeLine(stream: Writable, message: unknown): void;
