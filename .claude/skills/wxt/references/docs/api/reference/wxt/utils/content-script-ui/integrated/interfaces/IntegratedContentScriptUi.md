<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-ui/integrated/interfaces/IntegratedContentScriptUi.md -->
[API](../../../../../packages.md) / [wxt/utils/content-script-ui/integrated](../index.md) / IntegratedContentScriptUi

# Interface: IntegratedContentScriptUi\<TMounted>

Source: [packages/wxt/src/utils/content-script-ui/integrated.ts:56](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/integrated.ts#L56)

## Contents

* [Extends](#extends)
* [Type Parameters](#type-parameters)
  * [TMounted](#tmounted)
* [Properties](#properties)
  * [autoMount](#automount)
  * [mount](#mount)
  * [mounted](#mounted)
  * [remove](#remove)
  * [wrapper](#wrapper)

## Extends

* [`ContentScriptUi`](../../types/interfaces/ContentScriptUi.md)<`TMounted`>

## Type Parameters

### TMounted

`TMounted`

## Properties

### autoMount

> **autoMount**: (`options?`) => `void`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:138](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L138)

Call `ui.autoMount()` to automatically mount and remove the UI as the
anchor is dynamically added/removed by the webpage.

#### Parameters

##### options?

[`AutoMountOptions`](../../types/type-aliases/AutoMountOptions.md)

#### Returns

`void`

#### Inherited from

[`ContentScriptUi`](../../types/interfaces/ContentScriptUi.md).[`autoMount`](../../types/interfaces/ContentScriptUi.md#automount)

***

### mount

> **mount**: () => `void`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:127](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L127)

Function that mounts or remounts the UI on the page.

#### Returns

`void`

#### Inherited from

[`ContentScriptUi`](../../types/interfaces/ContentScriptUi.md).[`mount`](../../types/interfaces/ContentScriptUi.md#mount)

***

### mounted

> **mounted**: `TMounted` | `undefined`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:4](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L4)

#### Inherited from

[`ContentScriptUi`](../../types/interfaces/ContentScriptUi.md).[`mounted`](../../types/interfaces/ContentScriptUi.md#mounted)

***

### remove

> **remove**: () => `void`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:130](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L130)

Function that removes the UI from the webpage.

#### Returns

`void`

#### Inherited from

[`ContentScriptUi`](../../types/interfaces/ContentScriptUi.md).[`remove`](../../types/interfaces/ContentScriptUi.md#remove)

***

### wrapper

> **wrapper**: `HTMLElement`

Source: [packages/wxt/src/utils/content-script-ui/integrated.ts:60](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/integrated.ts#L60)

A wrapper div that assists in positioning.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
