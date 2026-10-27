<!-- source: https://wxt.dev/api/reference/wxt/functions/createServer.md -->
[API](../../packages.md) / [wxt](../index.md) / createServer

# Function: createServer()

> **createServer**(`inlineConfig?`): `Promise`<[`WxtDevServer`](../interfaces/WxtDevServer.md)>

Source: [packages/wxt/src/create-server.ts:31](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/create-server.ts#L31)

Creates a dev server and pre-builds all the files that need to exist before
loading the extension.

## Parameters

### inlineConfig?

[`InlineConfig`](../interfaces/InlineConfig.md)

## Returns

`Promise`<[`WxtDevServer`](../interfaces/WxtDevServer.md)>

## Example

```ts
const server = await wxt.createServer({
    // Enter config...
  });
  await server.start();
```

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
