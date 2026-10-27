<!-- source: https://wxt.dev/api/reference/wxt/interfaces/WxtDevServer.md -->
[API](../../packages.md) / [wxt](../index.md) / WxtDevServer

# Interface: WxtDevServer

Source: [packages/wxt/src/types.ts:581](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L581)

## Contents

* [Extends](#extends)
* [Properties](#properties)
  * [currentOutput](#currentoutput)
  * [host](#host)
  * [on?](#on)
  * [origin](#origin)
  * [port](#port)
  * [reloadContentScript](#reloadcontentscript)
  * [reloadExtension](#reloadextension)
  * [reloadPage](#reloadpage)
  * [restartBrowser](#restartbrowser)
  * [watcher](#watcher)
  * [ws](#ws)
* [Methods](#methods)
  * [restart()](#restart)
  * [start()](#start)
  * [stop()](#stop)
  * [transformHtml()](#transformhtml)

## Extends

* `Omit`<[`WxtBuilderServer`](WxtBuilderServer.md), `"listen"` | `"close"`>.[`ServerInfo`](ServerInfo.md)

## Properties

### currentOutput

> **currentOutput**: [`BuildOutput`](BuildOutput.md) | `undefined`

Source: [packages/wxt/src/types.ts:584](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L584)

Stores the current build output of the server.

***

### host

> **host**: `string`

Source: [packages/wxt/src/types.ts:1310](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1310)

Ex: `"localhost"`

#### Inherited from

[`ServerInfo`](ServerInfo.md).[`host`](ServerInfo.md#host)

***

### on?

> `optional` **on?**: (`event`, `callback`) => `void`

Source: [packages/wxt/src/types.ts:1305](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1305)

#### Parameters

##### event

`string`

##### callback

() => `void`

#### Returns

`void`

#### Inherited from

[`WxtBuilderServer`](WxtBuilderServer.md).[`on`](WxtBuilderServer.md#on)

***

### origin

> **origin**: `string`

Source: [packages/wxt/src/types.ts:1314](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1314)

Ex: `"http://localhost:3000"`

#### Inherited from

[`ServerInfo`](ServerInfo.md).[`origin`](ServerInfo.md#origin)

***

### port

> **port**: `number`

Source: [packages/wxt/src/types.ts:1312](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1312)

Ex: `3000`

#### Inherited from

[`ServerInfo`](ServerInfo.md).[`port`](ServerInfo.md#port)

***

### reloadContentScript

> **reloadContentScript**: (`payload`) => `void`

Source: [packages/wxt/src/types.ts:620](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L620)

Tell the extension to restart a content script.

#### Parameters

##### payload

[`ReloadContentScriptPayload`](ReloadContentScriptPayload.md)

Information about the content script to reload.

#### Returns

`void`

***

### reloadExtension

> **reloadExtension**: () => `void`

Source: [packages/wxt/src/types.ts:601](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L601)

Tell the extension to reload by running `browser.runtime.reload`.

#### Returns

`void`

***

### reloadPage

> **reloadPage**: (`path`) => `void`

Source: [packages/wxt/src/types.ts:614](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L614)

Tell an extension page to reload.

The path is the bundle path, not the input paths, so if the input paths is
"src/options/index.html", you would pass "options.html" because that's
where it is written to in the dist directory, and where it's available at
in the actual extension.

#### Parameters

##### path

`string`

#### Returns

`void`

#### Example

```ts
server.reloadPage('popup.html');
  server.reloadPage('sandbox.html');
```

***

### restartBrowser

> **restartBrowser**: () => `void`

Source: [packages/wxt/src/types.ts:622](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L622)

Grab the latest runner config and restart the browser.

#### Returns

`void`

***

### watcher

> **watcher**: `FSWatcher`

Source: [packages/wxt/src/types.ts:1304](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1304)

Chokidar file watcher instance.

#### Inherited from

[`WxtBuilderServer`](WxtBuilderServer.md).[`watcher`](WxtBuilderServer.md#watcher)

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

#### Inherited from

[`WxtBuilderServer`](WxtBuilderServer.md).[`ws`](WxtBuilderServer.md#ws)

## Methods

### restart()

> **restart**(): `Promise`<`void`>

Source: [packages/wxt/src/types.ts:593](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L593)

Close the browser, stop the server, rebuild the entire extension, and start
the server again.

#### Returns

`Promise`<`void`>

***

### start()

> **start**(): `Promise`<`void`>

Source: [packages/wxt/src/types.ts:586](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L586)

Start the server.

#### Returns

`Promise`<`void`>

***

### stop()

> **stop**(): `Promise`<`void`>

Source: [packages/wxt/src/types.ts:588](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L588)

Stop the server.

#### Returns

`Promise`<`void`>

***

### transformHtml()

> **transformHtml**(`url`, `html`, `originalUrl?`): `Promise`<`string`>

Source: [packages/wxt/src/types.ts:595](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L595)

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

#### Overrides

[`WxtBuilderServer`](WxtBuilderServer.md).[`transformHtml`](WxtBuilderServer.md#transformhtml)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
