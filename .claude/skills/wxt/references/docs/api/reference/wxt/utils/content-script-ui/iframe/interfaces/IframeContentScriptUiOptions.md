<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-ui/iframe/interfaces/IframeContentScriptUiOptions.md -->
[API](../../../../../packages.md) / [wxt/utils/content-script-ui/iframe](../index.md) / IframeContentScriptUiOptions

# Interface: IframeContentScriptUiOptions\<TMounted>

Source: [packages/wxt/src/utils/content-script-ui/iframe.ts:65](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/iframe.ts#L65)

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
  * [onBeforeMount?](#onbeforemount)
  * [onMount?](#onmount)
  * [onRemove?](#onremove)
  * [page](#page)
  * [position](#position)
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

### onBeforeMount?

> `optional` **onBeforeMount?**: (`wrapper`, `iframe`) => `void`

Source: [packages/wxt/src/utils/content-script-ui/iframe.ts:87](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/iframe.ts#L87)

Callback executed before mounting the UI. Use this function to customize
the iframe or wrapper elements before they are injected into the DOM. It
is called every time `ui.mount()` is called.

#### Parameters

##### wrapper

`HTMLElement`

##### iframe

`HTMLIFrameElement`

#### Returns

`void`

***

### onMount?

> `optional` **onMount?**: (`wrapper`, `iframe`) => `TMounted`

Source: [packages/wxt/src/utils/content-script-ui/iframe.ts:81](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/iframe.ts#L81)

Callback executed when mounting the UI. Use this function to customize
the iframe or wrapper element's appearance. It is called every time
`ui.mount()` is called.

Optionally return a value that can be accessed at `ui.mounted` or in the
`onRemove` callback.

#### Parameters

##### wrapper

`HTMLElement`

##### iframe

`HTMLIFrameElement`

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

### page

> **page**: `any`

Source: [packages/wxt/src/utils/content-script-ui/iframe.ts:72](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/iframe.ts#L72)

The path to the HTML page that will be shown in the iframe. This string
is passed into `browser.runtime.getURL`.

***

### position

> **position**: `"inline"` | `"overlay"` | `"modal"`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:50](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L50)

Choose between `"inline"`, `"overlay"`, or `"modal"` positioning.

***

### zIndex?

> `optional` **zIndex?**: `number`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:51](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L51)

The `z-index` used on the positioning element. Set to a positive number to
show your UI over website content.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
