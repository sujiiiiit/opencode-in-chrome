<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-ui/types/interfaces/ContentScriptOverlayPositioningOptions.md -->
[API](../../../../../packages.md) / [wxt/utils/content-script-ui/types](../index.md) / ContentScriptOverlayPositioningOptions

# Interface: ContentScriptOverlayPositioningOptions

Source: [packages/wxt/src/utils/content-script-ui/types.ts:55](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L55)

## Contents

* [Properties](#properties)
  * [alignment?](#alignment)
  * [position](#position)
  * [zIndex?](#zindex)

## Properties

### alignment?

> `optional` **alignment?**: [`ContentScriptOverlayAlignment`](../type-aliases/ContentScriptOverlayAlignment.md)

Source: [packages/wxt/src/utils/content-script-ui/types.ts:72](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L72)

When using `position: "overlay"`, the mounted element is 0px by 0px in
size. Alignment specifies which corner is aligned with that 0x0 pixel
space.

[Visualization of alignment
options](https://wxt.dev/content-script-ui-alignment.png)

#### Default

```ts
'top-left'
```

***

### position

> **position**: `"overlay"`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:56](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L56)

***

### zIndex?

> `optional` **zIndex?**: `number`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:61](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L61)

The `z-index` used on the positioning element. Set to a positive number to
show your UI over website content.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
