<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-ui/types/type-aliases/ContentScriptUiOptions.md -->
[API](../../../../../packages.md) / [wxt/utils/content-script-ui/types](../index.md) / ContentScriptUiOptions

# Type Alias: ContentScriptUiOptions\<TMounted>

> **ContentScriptUiOptions**<`TMounted`> = [`ContentScriptPositioningOptions`](ContentScriptPositioningOptions.md) & [`ContentScriptAnchoredOptions`](../interfaces/ContentScriptAnchoredOptions.md) & `object`

Source: [packages/wxt/src/utils/content-script-ui/types.ts:14](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/types.ts#L14)

Options shared by integrated, shadow root, and iframe UIs.

`position` selects `"inline"`, `"overlay"`, or `"modal"` positioning.
`zIndex` controls the positioning element's stacking level for overlays and
modals. `alignment` is available for overlays.

## Type Declaration

### onRemove?

> `optional` **onRemove?**: (`mounted`) => `void`

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

## Type Parameters

### TMounted

`TMounted`

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
