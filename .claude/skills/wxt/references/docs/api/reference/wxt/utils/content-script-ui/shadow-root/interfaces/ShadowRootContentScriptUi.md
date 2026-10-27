<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-ui/shadow-root/interfaces/ShadowRootContentScriptUi.md -->
[API](../../../../../packages.md) / [wxt/utils/content-script-ui/shadow-root](../index.md) / ShadowRootContentScriptUi

# Interface: ShadowRootContentScriptUi\<TMounted>

Source: [packages/wxt/src/utils/content-script-ui/shadow-root.ts:138](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/shadow-root.ts#L138)

## Contents

* [Extends](#extends)
* [Type Parameters](#type-parameters)
  * [TMounted](#tmounted)
* [Properties](#properties)
  * [autoMount](#automount)
  * [mount](#mount)
  * [mounted](#mounted)
  * [remove](#remove)
  * [shadow](#shadow)
  * [shadowHost](#shadowhost)
  * [uiContainer](#uicontainer)

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

### shadow

> **shadow**: `ShadowRoot`

Source: [packages/wxt/src/utils/content-script-ui/shadow-root.ts:153](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/shadow-root.ts#L153)

The shadow root performing the isolation.

***

### shadowHost

> **shadowHost**: `HTMLElement`

Source: [packages/wxt/src/utils/content-script-ui/shadow-root.ts:146](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/shadow-root.ts#L146)

The `HTMLElement` hosting the shadow root used to isolate the UI's styles.
This is the element that get's added to the DOM. This element's style is
not isolated from the webpage.

***

### uiContainer

> **uiContainer**: `HTMLElement`

Source: [packages/wxt/src/utils/content-script-ui/shadow-root.ts:151](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/shadow-root.ts#L151)

The container element inside the `ShadowRoot` whose styles are isolated.
The UI is mounted inside this `HTMLElement`.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
