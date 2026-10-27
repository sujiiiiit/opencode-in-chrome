<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-ui/types/interfaces/ContentScriptUi.md -->
[API](../../../../../packages.md) / [wxt/utils/content-script-ui/types](../index.md) / ContentScriptUi

# Interface: ContentScriptUi\<TMounted>

Source: [packages/wxt/src/utils/content-script-ui/types.ts:3](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L3)

## Contents

* [Extends](#extends)
* [Extended by](#extended-by)
* [Type Parameters](#type-parameters)
  * [TMounted](#tmounted)
* [Properties](#properties)
  * [autoMount](#automount)
  * [mount](#mount)
  * [mounted](#mounted)
  * [remove](#remove)

## Extends

* [`MountFunctions`](MountFunctions.md)

## Extended by

* [`IntegratedContentScriptUi`](../../integrated/interfaces/IntegratedContentScriptUi.md)
* [`ShadowRootContentScriptUi`](../../shadow-root/interfaces/ShadowRootContentScriptUi.md)
* [`IframeContentScriptUi`](../../iframe/interfaces/IframeContentScriptUi.md)

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

[`AutoMountOptions`](../type-aliases/AutoMountOptions.md)

#### Returns

`void`

#### Inherited from

[`MountFunctions`](MountFunctions.md).[`autoMount`](MountFunctions.md#automount)

***

### mount

> **mount**: () => `void`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:127](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L127)

Function that mounts or remounts the UI on the page.

#### Returns

`void`

#### Inherited from

[`MountFunctions`](MountFunctions.md).[`mount`](MountFunctions.md#mount)

***

### mounted

> **mounted**: `TMounted` | `undefined`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:4](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L4)

***

### remove

> **remove**: () => `void`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:130](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L130)

Function that removes the UI from the webpage.

#### Returns

`void`

#### Inherited from

[`MountFunctions`](MountFunctions.md).[`remove`](MountFunctions.md#remove)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
