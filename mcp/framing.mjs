// Message framing. Chrome native messaging: a 4-byte little-endian length, then JSON.
// The pipe and MCP stdio: one JSON message per line.

/** Calls `onMessage` for each native-messaging message read from `stream`. */
export function readNative(stream, onMessage) {
  let buffer = Buffer.alloc(0);
  stream.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0);
      if (buffer.length < 4 + length) break;
      const body = buffer.subarray(4, 4 + length).toString('utf8');
      buffer = buffer.subarray(4 + length);
      try {
        onMessage(JSON.parse(body));
      } catch {
        // A malformed message from Chrome is dropped.
      }
    }
  });
}

export function writeNative(stream, message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const head = Buffer.alloc(4);
  head.writeUInt32LE(body.length, 0);
  stream.write(Buffer.concat([head, body]));
}

/** Calls `onMessage` for each JSON line read from `stream`. */
export function readLines(stream, onMessage) {
  let pending = '';
  stream.setEncoding?.('utf8');
  stream.on('data', (chunk) => {
    pending += chunk;
    let index;
    while ((index = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, index).trim();
      pending = pending.slice(index + 1);
      if (!line) continue;
      try {
        onMessage(JSON.parse(line));
      } catch {
        // Not JSON: ignored.
      }
    }
  });
}

export function writeLine(stream, message) {
  stream.write(`${JSON.stringify(message)}\n`);
}
