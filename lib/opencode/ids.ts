// Port of opencode's ascending identifier (packages/schema/src/identifier.ts). Minting the
// message ID on the client lets a prompt keep one identity from the optimistic bubble through
// admission and delivery, and lets a queue rewrite know each replacement's ID up front.

const RANDOM_LENGTH = 14;
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

let lastTimestamp = 0;
let counter = 0;

/** A new `msg_…` ID that sorts after every ID minted before it. */
export function createMessageID(): string {
  const timestamp = Date.now();
  if (timestamp !== lastTimestamp) {
    lastTimestamp = timestamp;
    counter = 0;
  }
  counter++;

  const value = BigInt(timestamp) * 0x1000n + BigInt(counter);
  const time = Array.from({ length: 6 }, (_, index) =>
    Number((value >> BigInt(40 - 8 * index)) & 0xffn)
      .toString(16)
      .padStart(2, '0'),
  ).join('');
  const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_LENGTH));
  return 'msg_' + time + Array.from(bytes, (byte) => CHARS[byte % 62]).join('');
}
