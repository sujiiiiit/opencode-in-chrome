<!-- source: https://wxt.dev/api/reference/wxt/interfaces/WxtBuilderServer.md -->
[API](../../packages.md) / [wxt](../index.md) / WxtBuilderServer

# Interface: WxtBuilderServer

Source: [packages/wxt/src/types.ts:1279](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1279)

## Contents

* [Properties](#properties)
  * [watcher](#watcher)
  * [ws](#ws)
* [Methods](#methods)
  * [close()](#close)
  * [listen()](#listen)
  * [on()?](#on)
  * [transformHtml()](#transformhtml)

## Properties

### watcher

> **watcher**: `FSWatcher`

Source: [packages/wxt/src/types.ts:1304](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1304)

Chokidar file watcher instance.

***

### ws

> **ws**: `object`

Source: [packages/wxt/src/types.ts:1291](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1291)

The web socket server used to communicate with the extension.

#### on()

> **on**(`message`, `cb`): `void`

Listen for messages over the server's websocket.

##### Parameters

###### message

`string`

###### cb

(`payload`) => `void`

##### Returns

`void`

#### send()

> **send**(`message`, `payload?`): `void`

Send a message via the server's websocket, with an optional payload.

##### Parameters

###### message

`string`

###### payload?

`any`

##### Returns

`void`

##### Example

```ts
ws.send("wxt:reload-extension");
  ws.send("wxt:reload-content-script", { ... });
```

## Methods

### close()

> **close**(): `Promise`<`void`>

Source: [packages/wxt/src/types.ts:1283](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1283)

Stop the server.

#### Returns

`Promise`<`void`>

***

### listen()

> **listen**(): `Promise`<`void`>

Source: [packages/wxt/src/types.ts:1281](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1281)

Start the server.

#### Returns

`Promise`<`void`>

***

### on()?

> `optional` **on**(`event`, `callback`): `void`

Source: [packages/wxt/src/types.ts:1305](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1305)

#### Parameters

##### event

`string`

##### callback

() => `void`

#### Returns

`void`

***

### transformHtml()

> **transformHtml**(`url`, `html`, `originalUrl?`): `Promise`<`string`>

Source: [packages/wxt/src/types.ts:1285](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1285)

Transform the HTML for dev mode.

#### Parameters

##### url

`string`

##### html

`string`

##### originalUrl?

`string`

#### Returns

`Promise`<`string`>

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
