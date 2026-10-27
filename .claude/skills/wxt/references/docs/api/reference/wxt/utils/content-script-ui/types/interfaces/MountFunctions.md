<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-ui/types/interfaces/MountFunctions.md -->
[API](../../../../../packages.md) / [wxt/utils/content-script-ui/types](../index.md) / MountFunctions

# Interface: MountFunctions

Source: [packages/wxt/src/utils/content-script-ui/types.ts:133](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L133)

## Contents

* [Extends](#extends)
* [Extended by](#extended-by)
* [Properties](#properties)
  * [autoMount](#automount)
  * [mount](#mount)
  * [remove](#remove)

## Extends

* [`BaseMountFunctions`](BaseMountFunctions.md)

## Extended by

* [`ContentScriptUi`](ContentScriptUi.md)

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

***

### mount

> **mount**: () => `void`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:127](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L127)

Function that mounts or remounts the UI on the page.

#### Returns

`void`

#### Inherited from

[`BaseMountFunctions`](BaseMountFunctions.md).[`mount`](BaseMountFunctions.md#mount)

***

### remove

> **remove**: () => `void`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:130](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L130)

Function that removes the UI from the webpage.

#### Returns

`void`

#### Inherited from

[`BaseMountFunctions`](BaseMountFunctions.md).[`remove`](BaseMountFunctions.md#remove)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
