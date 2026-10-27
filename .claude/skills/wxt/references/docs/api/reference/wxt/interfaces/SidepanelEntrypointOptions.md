<!-- source: https://wxt.dev/api/reference/wxt/interfaces/SidepanelEntrypointOptions.md -->
[API](../../packages.md) / [wxt](../index.md) / SidepanelEntrypointOptions

# Interface: SidepanelEntrypointOptions

Source: [packages/wxt/src/types.ts:886](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L886)

## Contents

* [Extends](#extends)
* [Properties](#properties)
  * [browserStyle?](#browserstyle)
  * [defaultIcon?](#defaulticon)
  * [defaultTitle?](#defaulttitle)
  * [exclude?](#exclude)
  * [include?](#include)
  * [openAtInstall?](#openatinstall)

## Extends

* [`BaseEntrypointOptions`](BaseEntrypointOptions.md)

## Properties

### ~~browserStyle?~~

> `optional` **browserStyle?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`boolean`>

Source: [packages/wxt/src/types.ts:898](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L898)

#### Deprecated

See
https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/sidebar\_action#syntax

***

### defaultIcon?

> `optional` **defaultIcon?**: `string` | `Record`<`string`, `string`>

Source: [packages/wxt/src/types.ts:899](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L899)

***

### defaultTitle?

> `optional` **defaultTitle?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`string`>

Source: [packages/wxt/src/types.ts:900](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L900)

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

### openAtInstall?

> `optional` **openAtInstall?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`boolean`>

Source: [packages/wxt/src/types.ts:893](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L893)

Firefox only. See
https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/sidebar\_action#syntax

#### Default

```ts
false
```

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
