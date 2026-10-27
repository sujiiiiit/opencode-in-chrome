<!-- source: https://wxt.dev/api/reference/wxt/interfaces/BackgroundEntrypointOptions.md -->
[API](../../packages.md) / [wxt](../index.md) / BackgroundEntrypointOptions

# Interface: BackgroundEntrypointOptions

Source: [packages/wxt/src/types.ts:676](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L676)

## Contents

* [Extends](#extends)
* [Extended by](#extended-by)
* [Properties](#properties)
  * [exclude?](#exclude)
  * [include?](#include)
  * [persistent?](#persistent)
  * [type?](#type)

## Extends

* [`BaseEntrypointOptions`](BaseEntrypointOptions.md)

## Extended by

* [`BackgroundDefinition`](BackgroundDefinition.md)

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

[`BaseEntrypointOptions`](BaseEntrypointOptions.md).[`exclude`](BaseEntrypointOptions.md#exclude)

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

[`BaseEntrypointOptions`](BaseEntrypointOptions.md).[`include`](BaseEntrypointOptions.md#include)

***

### persistent?

> `optional` **persistent?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`boolean`>

Source: [packages/wxt/src/types.ts:677](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L677)

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

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
