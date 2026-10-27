<!-- source: https://wxt.dev/api/reference/wxt/interfaces/WxtModuleWithMetadata.md -->
[API](../../packages.md) / [wxt](../index.md) / WxtModuleWithMetadata

# Interface: WxtModuleWithMetadata\<TOptions>

Source: [packages/wxt/src/types.ts:1881](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1881)

## Contents

* [Extends](#extends)
* [Type Parameters](#type-parameters)
  * [TOptions](#toptions)
* [Properties](#properties)
  * [configKey?](#configkey)
  * [hooks?](#hooks)
  * [id](#id)
  * [imports?](#imports)
  * [name?](#name)
  * [setup?](#setup)
  * [type](#type)

## Extends

* [`WxtModule`](WxtModule.md)<`TOptions`>

## Type Parameters

### TOptions

`TOptions` *extends* [`WxtModuleOptions`](../type-aliases/WxtModuleOptions.md)

## Properties

### configKey?

> `optional` **configKey?**: `string`

Source: [packages/wxt/src/types.ts:1866](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1866)

Key for users to pass options into your module from their `wxt.config.ts`
file.

#### Inherited from

[`WxtModule`](WxtModule.md).[`configKey`](WxtModule.md#configkey)

***

### hooks?

> `optional` **hooks?**: `NestedHooks`<[`WxtHooks`](WxtHooks.md)>

Source: [packages/wxt/src/types.ts:1873](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1873)

Alternative to adding hooks in setup function with `wxt.hooks`. Hooks are
added before the `setup` function is called.

#### Inherited from

[`WxtModule`](WxtModule.md).[`hooks`](WxtModule.md#hooks)

***

### id

> **id**: `string`

Source: [packages/wxt/src/types.ts:1885](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1885)

***

### imports?

> `optional` **imports?**: `Import`\[]

Source: [packages/wxt/src/types.ts:1868](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1868)

Provide a list of imports to add to auto-imports.

#### Inherited from

[`WxtModule`](WxtModule.md).[`imports`](WxtModule.md#imports)

***

### name?

> `optional` **name?**: `string`

Source: [packages/wxt/src/types.ts:1861](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1861)

#### Inherited from

[`WxtModule`](WxtModule.md).[`name`](WxtModule.md#name)

***

### setup?

> `optional` **setup?**: [`WxtModuleSetup`](../type-aliases/WxtModuleSetup.md)<`TOptions`>

Source: [packages/wxt/src/types.ts:1878](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1878)

A custom function that can be used to setup hooks and call module-specific
APIs.

#### Inherited from

[`WxtModule`](WxtModule.md).[`setup`](WxtModule.md#setup)

***

### type

> **type**: `"local"` | `"node_module"`

Source: [packages/wxt/src/types.ts:1884](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1884)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
