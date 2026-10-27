<!-- source: https://wxt.dev/api/reference/wxt/interfaces/PopupEntrypointOptions.md -->
[API](../../packages.md) / [wxt](../index.md) / PopupEntrypointOptions

# Interface: PopupEntrypointOptions

Source: [packages/wxt/src/types.ts:842](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L842)

## Contents

* [Extends](#extends)
* [Properties](#properties)
  * [actionType?](#actiontype)
  * [browserStyle?](#browserstyle)
  * [defaultArea?](#defaultarea)
  * [defaultIcon?](#defaulticon)
  * [defaultState?](#defaultstate)
  * [defaultTitle?](#defaulttitle)
  * [exclude?](#exclude)
  * [include?](#include)
  * [mv2Key?](#mv2key)
  * [themeIcons?](#themeicons)

## Extends

* [`BaseEntrypointOptions`](BaseEntrypointOptions.md)

## Properties

### actionType?

> `optional` **actionType?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`"browser_action"` | `"page_action"`>

Source: [packages/wxt/src/types.ts:850](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L850)

The type of action to use in the manifest.

In MV2, defaults to `"browser_action"`. In MV3, `"browser_action"` is
converted to `"action"`, while `"page_action"` is kept as-is (Firefox MV3
only).

***

### browserStyle?

> `optional` **browserStyle?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`boolean`>

Source: [packages/wxt/src/types.ts:861](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L861)

***

### defaultArea?

> `optional` **defaultArea?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`"navbar"` | `"menupanel"` | `"tabstrip"` | `"personaltoolbar"`>

Source: [packages/wxt/src/types.ts:868](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L868)

Firefox only. Defines the part of the browser in which the button is
initially placed.

#### See

https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/action#default\_area

***

### defaultIcon?

> `optional` **defaultIcon?**: `Record`<`string`, `string`>

Source: [packages/wxt/src/types.ts:853](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L853)

***

### defaultState?

> `optional` **defaultState?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`"enabled"` | `"disabled"`>

Source: [packages/wxt/src/types.ts:860](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L860)

Chrome only. Controls the initial enabled/disabled state of the action.

#### See

https://developer.chrome.com/docs/extensions/reference/api/action#enabled\_state

***

### defaultTitle?

> `optional` **defaultTitle?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`string`>

Source: [packages/wxt/src/types.ts:854](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L854)

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

### ~~mv2Key?~~

> `optional` **mv2Key?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`"browser_action"` | `"page_action"`>

Source: [packages/wxt/src/types.ts:852](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L852)

#### Deprecated

Use `actionType` instead.

***

### themeIcons?

> `optional` **themeIcons?**: [`ThemeIcon`](ThemeIcon.md)\[]

Source: [packages/wxt/src/types.ts:876](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L876)

Firefox only. Icons for light and dark themes.

#### See

https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/action#theme\_icons

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
