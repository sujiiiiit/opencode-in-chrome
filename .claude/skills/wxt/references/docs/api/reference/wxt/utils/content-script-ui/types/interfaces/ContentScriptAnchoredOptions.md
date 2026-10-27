<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-ui/types/interfaces/ContentScriptAnchoredOptions.md -->
[API](../../../../../packages.md) / [wxt/utils/content-script-ui/types](../index.md) / ContentScriptAnchoredOptions

# Interface: ContentScriptAnchoredOptions

Source: [packages/wxt/src/utils/content-script-ui/types.ts:99](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L99)

## Contents

* [Properties](#properties)
  * [anchor?](#anchor)
  * [append?](#append)

## Properties

### anchor?

> `optional` **anchor?**: `string` | `Element` | (() => `string` | `Element` | `null` | `undefined`) | `null`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:105](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L105)

A CSS selector, XPath expression, element, or function that returns one of
the three. Along with `append`, the `anchor` dictates where in the page the
UI will be added.

***

### append?

> `optional` **append?**: [`ContentScriptAppendMode`](../type-aliases/ContentScriptAppendMode.md) | ((`anchor`, `ui`) => `void`)

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

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
