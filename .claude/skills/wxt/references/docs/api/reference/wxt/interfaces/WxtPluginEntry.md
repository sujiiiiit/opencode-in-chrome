<!-- source: https://wxt.dev/api/reference/wxt/interfaces/WxtPluginEntry.md -->
[API](../../packages.md) / [wxt](../index.md) / WxtPluginEntry

# Interface: WxtPluginEntry

Source: [packages/wxt/src/types.ts:1698](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1698)

A plugin registered via `addWxtPlugin`, along with an optional `apply`
function controlling which entrypoints it's loaded in.

## Contents

* [Properties](#properties)
  * [apply?](#apply)
  * [module](#module)

## Properties

### apply?

> `optional` **apply?**: (`entrypoint`) => `boolean`

Source: [packages/wxt/src/types.ts:1705](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1705)

Return `true` to include the plugin in this entrypoint. When omitted, the
plugin is included in every entrypoint.

#### Parameters

##### entrypoint

[`Entrypoint`](../type-aliases/Entrypoint.md)

#### Returns

`boolean`

***

### module

> **module**: `string`

Source: [packages/wxt/src/types.ts:1700](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1700)

Import path or absolute file path to the plugin module.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
