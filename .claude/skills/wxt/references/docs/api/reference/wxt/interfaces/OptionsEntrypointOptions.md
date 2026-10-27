<!-- source: https://wxt.dev/api/reference/wxt/interfaces/OptionsEntrypointOptions.md -->
[API](../../packages.md) / [wxt](../index.md) / OptionsEntrypointOptions

# Interface: OptionsEntrypointOptions

Source: [packages/wxt/src/types.ts:879](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L879)

## Contents

* [Extends](#extends)
* [Properties](#properties)
  * [browserStyle?](#browserstyle)
  * [chromeStyle?](#chromestyle)
  * [exclude?](#exclude)
  * [include?](#include)
  * [openInTab?](#openintab)
  * [title?](#title)

## Extends

* [`BaseEntrypointOptions`](BaseEntrypointOptions.md)

## Properties

### browserStyle?

> `optional` **browserStyle?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`boolean`>

Source: [packages/wxt/src/types.ts:882](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L882)

***

### chromeStyle?

> `optional` **chromeStyle?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`boolean`>

Source: [packages/wxt/src/types.ts:883](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L883)

***

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

### openInTab?

> `optional` **openInTab?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`boolean`>

Source: [packages/wxt/src/types.ts:881](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L881)

***

### title?

> `optional` **title?**: `string`

Source: [packages/wxt/src/types.ts:880](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L880)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
