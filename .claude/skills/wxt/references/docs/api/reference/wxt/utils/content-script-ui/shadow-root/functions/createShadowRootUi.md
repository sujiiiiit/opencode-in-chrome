<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-ui/shadow-root/functions/createShadowRootUi.md -->
[API](../../../../../packages.md) / [wxt/utils/content-script-ui/shadow-root](../index.md) / createShadowRootUi

# Function: createShadowRootUi()

> **createShadowRootUi**<`TMounted`>(`ctx`, `options`): `Promise`<[`ShadowRootContentScriptUi`](../interfaces/ShadowRootContentScriptUi.md)<`TMounted`>>

Source: [packages/wxt/src/utils/content-script-ui/shadow-root.ts:20](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/shadow-root.ts#L20)

Create a content script UI inside a
[`ShadowRoot`](https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot).

> This function is async because it has to load the CSS via a network call.

## Type Parameters

### TMounted

`TMounted`

## Parameters

### ctx

[`ContentScriptContext`](../../../content-script-context/classes/ContentScriptContext.md)

### options

[`ShadowRootContentScriptUiOptions`](../interfaces/ShadowRootContentScriptUiOptions.md)<`TMounted`>

Shadow root options. See [ContentScriptUiOptions](../../types/type-aliases/ContentScriptUiOptions.md) for
shared positioning, anchoring, `append`, and removal options.

## Returns

`Promise`<[`ShadowRootContentScriptUi`](../interfaces/ShadowRootContentScriptUi.md)<`TMounted`>>

## See

https://wxt.dev/guide/essentials/content-scripts.html#shadow-root

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
