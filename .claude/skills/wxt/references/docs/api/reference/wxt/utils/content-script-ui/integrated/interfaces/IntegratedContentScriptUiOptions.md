<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-ui/integrated/interfaces/IntegratedContentScriptUiOptions.md -->
[API](../../../../../packages.md) / [wxt/utils/content-script-ui/integrated](../index.md) / IntegratedContentScriptUiOptions

# Interface: IntegratedContentScriptUiOptions\<TMounted>

Source: [packages/wxt/src/utils/content-script-ui/integrated.ts:68](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/integrated.ts#L68)

Options shared by integrated, shadow root, and iframe UIs.

`position` selects `"inline"`, `"overlay"`, or `"modal"` positioning.
`zIndex` controls the positioning element's stacking level for overlays and
modals. `alignment` is available for overlays.

## Contents

* [Type Parameters](#type-parameters)
  * [TMounted](#tmounted)
* [Properties](#properties)
  * [alignment?](#alignment)
  * [anchor?](#anchor)
  * [append?](#append)
  * [onMount](#onmount)
  * [onRemove?](#onremove)
  * [position](#position)
  * [tag?](#tag)
  * [zIndex?](#zindex)

## Type Parameters

### TMounted

`TMounted`

## Properties

### alignment?

> `optional` **alignment?**: [`ContentScriptOverlayAlignment`](../../types/type-aliases/ContentScriptOverlayAlignment.md)

Source: [packages/wxt/src/utils/content-script-ui/types.ts:52](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L52)

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

### anchor?

> `optional` **anchor?**: `string` | `Element` | (() => `string` | `Element` | `null` | `undefined`) | `null`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:105](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L105)

A CSS selector, XPath expression, element, or function that returns one of
the three. Along with `append`, the `anchor` dictates where in the page the
UI will be added.

***

### append?

> `optional` **append?**: [`ContentScriptAppendMode`](../../types/type-aliases/ContentScriptAppendMode.md) | ((`anchor`, `ui`) => `void`)

Source: [packages/wxt/src/utils/content-script-ui/types.ts:122](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L122)

In combination with `anchor`, decide how to add the UI to the DOM.

* `"last"` (default) - Add the UI as the last child of the `anchor` element
* `"first"` - Add the UI as the first child of the `anchor` element
* `"replace"` - Replace the `anchor` element with the UI.
* `"before"` - Add the UI as the sibling before the `anchor` element
* `"after"` - Add the UI as the sibling after the `anchor` element
* `(anchor, ui) => void` - Customizable function that let's you add the UI to
  the DOM

***

### onMount

> **onMount**: (`wrapper`) => `TMounted`

Source: [packages/wxt/src/utils/content-script-ui/integrated.ts:84](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/integrated.ts#L84)

Callback executed when mounting the UI. This function should create and
append the UI to the `wrapper` element. It is called every time
`ui.mount()` is called.

Optionally return a value that can be accessed at `ui.mounted` or in the
`onRemove` callback.

#### Parameters

##### wrapper

`HTMLElement`

#### Returns

`TMounted`

***

### onRemove?

> `optional` **onRemove?**: (`mounted`) => `void`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:24](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L24)

Callback called before the UI is removed from the webpage. Use to cleanup
your UI, like unmounting your Vue or React apps.

Note that this callback is called only when `ui.remove` is called - that
means it is not called automatically when the anchor is removed, unless
you use `autoMount`.

#### Parameters

##### mounted

`TMounted` | `undefined`

#### Returns

`void`

***

### position

> **position**: `"inline"` | `"overlay"` | `"modal"`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:50](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L50)

Choose between `"inline"`, `"overlay"`, or `"modal"` positioning.

***

### tag?

> `optional` **tag?**: `string`

Source: [packages/wxt/src/utils/content-script-ui/integrated.ts:75](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/integrated.ts#L75)

Tag used to create the wrapper element.

#### Default

```ts
'div'
```

***

### zIndex?

> `optional` **zIndex?**: `number`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:51](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L51)

The `z-index` used on the positioning element. Set to a positive number to
show your UI over website content.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
