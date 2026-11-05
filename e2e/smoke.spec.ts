import { expect, test } from './fixtures';

test('the extension connects to the paired server only once browser access is on', async ({ sw, fake, connect }) => {
  await sw.evaluate(() => new Promise((r) => setTimeout(r, 1000)));
  expect(fake.ticketRequests).toHaveLength(0);
  await connect();
  const connection = await fake.waitForConnection();
  expect(connection.name).toBe('browser');
  expect(connection.directory).toMatch(/\.opencode-chrome[\\/]workspace$/);
  expect(connection.tools.map((t) => t.name)).toEqual(expect.arrayContaining(['tabs_context', 'tabs_create', 'tabs_close']));
});

test('a tool call without a session is refused', async ({ fake, connect }) => {
  await connect();
  const connection = await fake.waitForConnection();
  const result = await connection.callTool(undefined, 'tabs_context');
  expect(result.isError).toBe(true);
  expect(result.content[0]).toMatchObject({ type: 'text', text: expect.stringMatching(/^NO_SESSION: /) });
});
