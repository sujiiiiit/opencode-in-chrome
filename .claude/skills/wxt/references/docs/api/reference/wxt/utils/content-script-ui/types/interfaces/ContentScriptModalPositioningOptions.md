<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-ui/types/interfaces/ContentScriptModalPositioningOptions.md -->
[API](../../../../../packages.md) / [wxt/utils/content-script-ui/types](../index.md) / ContentScriptModalPositioningOptions

# Interface: ContentScriptModalPositioningOptions

Source: [packages/wxt/src/utils/content-script-ui/types.ts:82](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L82)

Modal positioning options.

## Contents

* [Properties](#properties)
  * [alignment?](#alignment)
  * [position](#position)
  * [zIndex?](#zindex)

## Properties

### alignment?

> `optional` **alignment?**: `undefined`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:85](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L85)

Only available when `position` is `"overlay"`.

***

### position

> **position**: `"modal"`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:83](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L83)

***

### zIndex?

> `optional` **zIndex?**: `number`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:84](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L84)

The `z-index` used on the `shadowHost` element. Set to a
positive number to show your UI over website content.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
