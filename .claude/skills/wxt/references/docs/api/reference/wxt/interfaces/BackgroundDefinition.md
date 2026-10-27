<!-- source: https://wxt.dev/api/reference/wxt/interfaces/BackgroundDefinition.md -->
[API](../../packages.md) / [wxt](../index.md) / BackgroundDefinition

# Interface: BackgroundDefinition

Source: [packages/wxt/src/types.ts:1033](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1033)

## Contents

* [Extends](#extends)
* [Properties](#properties)
  * [exclude?](#exclude)
  * [include?](#include)
  * [persistent?](#persistent)
  * [type?](#type)
* [Methods](#methods)
  * [main()](#main)

## Extends

* [`BackgroundEntrypointOptions`](BackgroundEntrypointOptions.md)

## Properties

### exclude?

> `optional` **exclude?**: `string`\[]

Source: [packages/wxt/src/types.ts:673](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L673)

List of target browsers to exclude this entrypoint from. Cannot be used
with `include`. You must choose one of the two options.

#### Default

```ts
undefined
```

#### Inherited from

[`BackgroundEntrypointOptions`](BackgroundEntrypointOptions.md).[`exclude`](BackgroundEntrypointOptions.md#exclude)

***

### include?

> `optional` **include?**: `string`\[]

Source: [packages/wxt/src/types.ts:666](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L666)

List of target browsers to include this entrypoint in. Defaults to being
included in all builds. Cannot be used with `exclude`. You must choose one
of the two options.

#### Default

```ts
undefined
```

#### Inherited from

[`BackgroundEntrypointOptions`](BackgroundEntrypointOptions.md).[`include`](BackgroundEntrypointOptions.md#include)

***

### persistent?

> `optional` **persistent?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`boolean`>

Source: [packages/wxt/src/types.ts:677](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L677)

#### Inherited from

[`BackgroundEntrypointOptions`](BackgroundEntrypointOptions.md).[`persistent`](BackgroundEntrypointOptions.md#persistent)

***

### type?

> `optional` **type?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`"module"`>

Source: [packages/wxt/src/types.ts:687](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L687)

Set to `"module"` to output the background entrypoint as ESM. ESM outputs
can share chunks and reduce the overall size of the bundled extension.

When `undefined`, the background is bundled individually into an IIFE
format.

#### Default

```ts
undefined
```

#### Inherited from

[`BackgroundEntrypointOptions`](BackgroundEntrypointOptions.md).[`type`](BackgroundEntrypointOptions.md#type)

## Methods

### main()

> **main**(): `void`

Source: [packages/wxt/src/types.ts:1038](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1038)

Main function executed when the background script is started. Cannot be
async.

#### Returns

`void`

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
