<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-context/classes/ContentScriptContext.md -->
[API](../../../../packages.md) / [wxt/utils/content-script-context](../index.md) / ContentScriptContext

# Class: ContentScriptContext

Source: [packages/wxt/src/utils/content-script-context.ts:45](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L45)

Implements
[`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).
Used to detect and stop content script code when the script is invalidated.

It also provides several utilities like `ctx.setTimeout` and
`ctx.setInterval` that should be used in content scripts instead of
`window.setTimeout` or `window.setInterval`.

To create context for testing, you can use the class's constructor:

```ts
import { ContentScriptContext } from 'wxt/utils/content-scripts-context';

test('storage listener should be removed when context is invalidated', () => {
  const ctx = new ContentScriptContext('test');
  const item = storage.defineItem('local:count', { defaultValue: 0 });
  const watcher = vi.fn();

  const unwatch = item.watch(watcher);
  ctx.onInvalidated(unwatch); // Listen for invalidate here

  await item.setValue(1);
  expect(watcher).toBeCalledTimes(1);
  expect(watcher).toBeCalledWith(1, 0);

  ctx.notifyInvalidated(); // Use this function to invalidate the context
  await item.setValue(2);
  expect(watcher).toBeCalledTimes(1);
});
```

## Contents

* [Implements](#implements)
* [Constructors](#constructors)
  * [Constructor](#constructor)
* [Properties](#properties)
  * [options?](#options)
* [Accessors](#accessors)
  * [isInvalid](#isinvalid)
  * [isValid](#isvalid)
  * [signal](#signal)
* [Methods](#methods)
  * [abort()](#abort)
  * [addEventListener()](#addeventlistener)
  * [block()](#block)
  * [listenForNewerScripts()](#listenfornewerscripts)
  * [notifyInvalidated()](#notifyinvalidated)
  * [onInvalidated()](#oninvalidated)
  * [requestAnimationFrame()](#requestanimationframe)
  * [requestIdleCallback()](#requestidlecallback)
  * [setInterval()](#setinterval)
  * [setTimeout()](#settimeout)
  * [stopOldScripts()](#stopoldscripts)
  * [verifyScriptStartedEvent()](#verifyscriptstartedevent)

## Implements

* `AbortController`

## Constructors

### Constructor

> **new ContentScriptContext**(`contentScriptName`, `options?`): `ContentScriptContext`

Source: [packages/wxt/src/utils/content-script-context.ts:54](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L54)

#### Parameters

##### contentScriptName

`string`

##### options?

`Omit`<[`ContentScriptDefinition`](../../../type-aliases/ContentScriptDefinition.md), `"main"`>

#### Returns

`ContentScriptContext`

## Properties

### options?

> `readonly` `optional` **options?**: `Omit`<[`ContentScriptDefinition`](../../../type-aliases/ContentScriptDefinition.md), `"main"`>

Source: [packages/wxt/src/utils/content-script-context.ts:56](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L56)

## Accessors

### isInvalid

#### Get Signature

> **get** **isInvalid**(): `boolean`

Source: [packages/wxt/src/utils/content-script-context.ts:73](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L73)

##### Returns

`boolean`

***

### isValid

#### Get Signature

> **get** **isValid**(): `boolean`

Source: [packages/wxt/src/utils/content-script-context.ts:80](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L80)

##### Returns

`boolean`

***

### signal

#### Get Signature

> **get** **signal**(): `AbortSignal`

Source: [packages/wxt/src/utils/content-script-context.ts:65](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L65)

The **`signal`** read-only property of the AbortController interface returns an AbortSignal object instance, which can be used to communicate with/abort an asynchronous operation as desired.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortController/signal)

##### Returns

`AbortSignal`

#### Implementation of

`AbortController.signal`

## Methods

### abort()

> **abort**(`reason?`): `void`

Source: [packages/wxt/src/utils/content-script-context.ts:69](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L69)

The **`abort()`** method of the AbortController interface aborts an asynchronous operation before it has completed. This is able to abort fetch requests, the consumption of any response bodies, or streams.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortController/abort)

#### Parameters

##### reason?

`any`

#### Returns

`void`

#### Implementation of

`AbortController.abort`

***

### addEventListener()

#### Call Signature

> **addEventListener**<`TType`>(`target`, `type`, `handler`, `options?`): `void`

Source: [packages/wxt/src/utils/content-script-context.ts:205](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L205)

Call `target.addEventListener` and remove the event listener when the
context is invalidated.

Listeners can be canceled by calling the normal `removeEventListener`
function.

Includes additional events useful for content scripts:

* `"wxt:locationchange"` - Triggered when HTML5 history mode is used to
  change URL. Content scripts are not reloaded when navigating this way, so
  this can be used to reset the content script state on URL change, or run
  custom code.

##### Type Parameters

###### TType

`TType` *extends* keyof [`WxtWindowEventMap`](../interfaces/WxtWindowEventMap.md)

##### Parameters

###### target

`Window`

###### type

`TType`

###### handler

(`event`) => `void`

###### options?

`AddEventListenerOptions`

##### Returns

`void`

##### Example

```ts
ctx.addEventListener(document, 'visibilitychange', () => {
    // ...
  });
  ctx.addEventListener(window, 'wxt:locationchange', () => {
    // ...
  });
```

#### Call Signature

> **addEventListener**<`TType`>(`target`, `type`, `handler`, `options?`): `void`

Source: [packages/wxt/src/utils/content-script-context.ts:211](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L211)

Call `target.addEventListener` and remove the event listener when the
context is invalidated.

Listeners can be canceled by calling the normal `removeEventListener`
function.

Includes additional events useful for content scripts:

* `"wxt:locationchange"` - Triggered when HTML5 history mode is used to
  change URL. Content scripts are not reloaded when navigating this way, so
  this can be used to reset the content script state on URL change, or run
  custom code.

##### Type Parameters

###### TType

`TType` *extends* keyof `DocumentEventMap`

##### Parameters

###### target

`Document`

###### type

`TType`

###### handler

(`event`) => `void`

###### options?

`AddEventListenerOptions`

##### Returns

`void`

##### Example

```ts
ctx.addEventListener(document, 'visibilitychange', () => {
    // ...
  });
  ctx.addEventListener(window, 'wxt:locationchange', () => {
    // ...
  });
```

#### Call Signature

> **addEventListener**<`TTarget`>(`target`, ...`params`): `void`

Source: [packages/wxt/src/utils/content-script-context.ts:217](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L217)

Call `target.addEventListener` and remove the event listener when the
context is invalidated.

Listeners can be canceled by calling the normal `removeEventListener`
function.

Includes additional events useful for content scripts:

* `"wxt:locationchange"` - Triggered when HTML5 history mode is used to
  change URL. Content scripts are not reloaded when navigating this way, so
  this can be used to reset the content script state on URL change, or run
  custom code.

##### Type Parameters

###### TTarget

`TTarget` *extends* `EventTarget`

##### Parameters

###### target

`TTarget`

###### params

...`Parameters`<`TTarget`\[`"addEventListener"`]>

##### Returns

`void`

##### Example

```ts
ctx.addEventListener(document, 'visibilitychange', () => {
    // ...
  });
  ctx.addEventListener(window, 'wxt:locationchange', () => {
    // ...
  });
```

***

### block()

> **block**<`T`>(): `Promise`<`T`>

Source: [packages/wxt/src/utils/content-script-context.ts:114](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L114)

Return a promise that never resolves. Useful if you have an async function
that shouldn't run after the context is expired.

#### Type Parameters

##### T

`T`

#### Returns

`Promise`<`T`>

#### Example

```ts
const getValueFromStorage = async () => {
    if (ctx.isInvalid) return ctx.block();

    // ...
  };
```

***

### listenForNewerScripts()

> **listenForNewerScripts**(): `void`

Source: [packages/wxt/src/utils/content-script-context.ts:285](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L285)

#### Returns

`void`

***

### notifyInvalidated()

> **notifyInvalidated**(): `void`

Source: [packages/wxt/src/utils/content-script-context.ts:246](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L246)

**`Internal`**

Abort the abort controller and execute all `onInvalidated` listeners.

#### Returns

`void`

***

### onInvalidated()

> **onInvalidated**(`cb`): () => `void`

Source: [packages/wxt/src/utils/content-script-context.ts:98](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L98)

Add a listener that is called when the content script's context is
invalidated.

#### Parameters

##### cb

() => `void`

#### Returns

A function to remove the listener.

() => `void`

#### Example

```ts
browser.runtime.onMessage.addListener(cb);
  const removeInvalidatedListener = ctx.onInvalidated(() => {
    browser.runtime.onMessage.removeListener(cb);
  });
  // ...
  removeInvalidatedListener();
```

***

### requestAnimationFrame()

> **requestAnimationFrame**(`callback`): `number`

Source: [packages/wxt/src/utils/content-script-context.ts:155](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L155)

Wrapper around `window.requestAnimationFrame` that automatically cancels
the request when invalidated.

Callbacks can be canceled by calling the normal `cancelAnimationFrame`
function.

#### Parameters

##### callback

`FrameRequestCallback`

#### Returns

`number`

***

### requestIdleCallback()

> **requestIdleCallback**(`callback`, `options?`): `number`

Source: [packages/wxt/src/utils/content-script-context.ts:171](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L171)

Wrapper around `window.requestIdleCallback` that automatically cancels the
request when invalidated.

Callbacks can be canceled by calling the normal `cancelIdleCallback`
function.

#### Parameters

##### callback

`IdleRequestCallback`

##### options?

`IdleRequestOptions`

#### Returns

`number`

***

### setInterval()

> **setInterval**(`handler`, `timeout?`): `number`

Source: [packages/wxt/src/utils/content-script-context.ts:126](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L126)

Wrapper around `window.setInterval` that automatically clears the interval
when invalidated.

Intervals can be cleared by calling the normal `clearInterval` function.

#### Parameters

##### handler

() => `void`

##### timeout?

`number`

#### Returns

`number`

***

### setTimeout()

> **setTimeout**(`handler`, `timeout?`): `number`

Source: [packages/wxt/src/utils/content-script-context.ts:140](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L140)

Wrapper around `window.setTimeout` that automatically clears the interval
when invalidated.

Timeouts can be cleared by calling the normal `setTimeout` function.

#### Parameters

##### handler

() => `void`

##### timeout?

`number`

#### Returns

`number`

***

### stopOldScripts()

> **stopOldScripts**(): `void`

Source: [packages/wxt/src/utils/content-script-context.ts:253](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L253)

#### Returns

`void`

***

### verifyScriptStartedEvent()

> **verifyScriptStartedEvent**(`event`): `boolean`

Source: [packages/wxt/src/utils/content-script-context.ts:277](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-context.ts#L277)

#### Parameters

##### event

`CustomEvent`

#### Returns

`boolean`

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
