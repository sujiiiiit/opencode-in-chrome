<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-ui/shadow-root/interfaces/ShadowRootContentScriptUiOptions.md -->
[API](../../../../../packages.md) / [wxt/utils/content-script-ui/shadow-root](../index.md) / ShadowRootContentScriptUiOptions

# Interface: ShadowRootContentScriptUiOptions\<TMounted>

Source: [packages/wxt/src/utils/content-script-ui/shadow-root.ts:161](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/shadow-root.ts#L161)

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
  * [css?](#css)
  * [inheritStyles?](#inheritstyles)
  * [isolateEvents?](#isolateevents)
  * [mode?](#mode)
  * [name](#name)
  * [onMount](#onmount)
  * [onRemove?](#onremove)
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

### css?

> `optional` **css?**: `string`

Source: [packages/wxt/src/utils/content-script-ui/shadow-root.ts:175](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/shadow-root.ts#L175)

Custom CSS text to apply to the UI. If your content script
imports/generates CSS and you've set `cssInjectionMode: "ui"`, the
imported CSS will be included automatically. You do not need to pass
those styles in here. This is for any additional styles not in the
imported CSS.

***

### inheritStyles?

> `optional` **inheritStyles?**: `boolean`

Source: [packages/wxt/src/utils/content-script-ui/shadow-root.ts:213](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/shadow-root.ts#L213)

By default, WXT adds `all: initial` to the shadow root before the rest of
your CSS. This resets any inheritable CSS styles that [normally pierce
the Shadow
DOM](https://open-wc.org/guides/knowledge/styling/styles-piercing-shadow-dom/).

WXT resets everything but:

* **`rem` Units**: they continue to scale based off the webpage's HTML
  `font-size`.
* **CSS Variables/Custom Properties**: CSS variables defined outside the
  shadow root can be accessed inside it.
* **`@font-face` Definitions**: Fonts defined outside the shadow root can
  be used inside it.

To disable this behavior and inherit styles from the webpage, set
`inheritStyles: true`.

#### Default

```ts
false
```

***

### isolateEvents?

> `optional` **isolateEvents?**: `boolean` | `string`\[]

Source: [packages/wxt/src/utils/content-script-ui/shadow-root.ts:192](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/shadow-root.ts#L192)

When enabled, `event.stopPropagation` will be called on events trying to
bubble out of the shadow root.

* Set to `true` to stop the propagation of a default set of events,
  `["keyup", "keydown", "keypress"]`
* Set to an array of event names to stop the propagation of a custom list
  of events

***

### mode?

> `optional` **mode?**: `"closed"` | `"open"`

Source: [packages/wxt/src/utils/content-script-ui/shadow-root.ts:182](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/shadow-root.ts#L182)

ShadowRoot's mode.

#### Default

```ts
'open'
```

#### See

https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/mode

***

### name

> **name**: `string`

Source: [packages/wxt/src/utils/content-script-ui/shadow-root.ts:167](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/shadow-root.ts#L167)

The name of the custom component used to host the ShadowRoot. Must be
kebab-case.

***

### onMount

> **onMount**: (`uiContainer`, `shadow`, `shadowHost`) => `TMounted`

Source: [packages/wxt/src/utils/content-script-ui/shadow-root.ts:222](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/shadow-root.ts#L222)

Callback executed when mounting the UI. This function should create and
append the UI to the `uiContainer` element. It is called every time
`ui.mount()` is called.

Optionally return a value that can be accessed at `ui.mounted` or in the
`onRemove` callback.

#### Parameters

##### uiContainer

`HTMLElement`

##### shadow

`ShadowRoot`

##### shadowHost

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

### zIndex?

> `optional` **zIndex?**: `number`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:51](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L51)

The `z-index` used on the positioning element. Set to a positive number to
show your UI over website content.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
