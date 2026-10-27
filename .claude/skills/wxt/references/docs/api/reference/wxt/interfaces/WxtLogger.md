<!-- source: https://wxt.dev/api/reference/wxt/interfaces/WxtLogger.md -->
[API](../../packages.md) / [wxt](../index.md) / WxtLogger

# Interface: WxtLogger

Source: [packages/wxt/src/types.ts:650](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L650)

The logger available at `wxt.logger` and `wxt.config.logger`. Extends
[Logger](Logger.md) with a `warnOnce` which only logs a message once per process.

## Contents

* [Extends](#extends)
* [Properties](#properties)
  * [level](#level)
* [Methods](#methods)
  * [debug()](#debug)
  * [error()](#error)
  * [fatal()](#fatal)
  * [info()](#info)
  * [log()](#log)
  * [success()](#success)
  * [warn()](#warn)
  * [warnOnce()](#warnonce)

## Extends

* [`Logger`](Logger.md)

## Properties

### level

> **level**: `LogLevel`

Source: [packages/wxt/src/types.ts:643](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L643)

#### Inherited from

[`Logger`](Logger.md).[`level`](Logger.md#level)

## Methods

### debug()

> **debug**(...`args`): `void`

Source: [packages/wxt/src/types.ts:636](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L636)

#### Parameters

##### args

...`any`\[]

#### Returns

`void`

#### Inherited from

[`Logger`](Logger.md).[`debug`](Logger.md#debug)

***

### error()

> **error**(...`args`): `void`

Source: [packages/wxt/src/types.ts:640](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L640)

#### Parameters

##### args

...`any`\[]

#### Returns

`void`

#### Inherited from

[`Logger`](Logger.md).[`error`](Logger.md#error)

***

### fatal()

> **fatal**(...`args`): `void`

Source: [packages/wxt/src/types.ts:641](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L641)

#### Parameters

##### args

...`any`\[]

#### Returns

`void`

#### Inherited from

[`Logger`](Logger.md).[`fatal`](Logger.md#fatal)

***

### info()

> **info**(...`args`): `void`

Source: [packages/wxt/src/types.ts:638](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L638)

#### Parameters

##### args

...`any`\[]

#### Returns

`void`

#### Inherited from

[`Logger`](Logger.md).[`info`](Logger.md#info)

***

### log()

> **log**(...`args`): `void`

Source: [packages/wxt/src/types.ts:637](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L637)

#### Parameters

##### args

...`any`\[]

#### Returns

`void`

#### Inherited from

[`Logger`](Logger.md).[`log`](Logger.md#log)

***

### success()

> **success**(...`args`): `void`

Source: [packages/wxt/src/types.ts:642](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L642)

#### Parameters

##### args

...`any`\[]

#### Returns

`void`

#### Inherited from

[`Logger`](Logger.md).[`success`](Logger.md#success)

***

### warn()

> **warn**(...`args`): `void`

Source: [packages/wxt/src/types.ts:639](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L639)

#### Parameters

##### args

...`any`\[]

#### Returns

`void`

#### Inherited from

[`Logger`](Logger.md).[`warn`](Logger.md#warn)

***

### warnOnce()

> **warnOnce**(...`args`): `void`

Source: [packages/wxt/src/types.ts:655](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L655)

Same as [Logger.warn](Logger.md#warn), but only logs a given message once per process,
even if called multiple times with the same arguments.

#### Parameters

##### args

...`any`\[]

#### Returns

`void`

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
