<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-ui/iframe/functions/createIframeUi.md -->
[API](../../../../../packages.md) / [wxt/utils/content-script-ui/iframe](../index.md) / createIframeUi

# Function: createIframeUi()

> **createIframeUi**<`TMounted`>(`ctx`, `options`): [`IframeContentScriptUi`](../interfaces/IframeContentScriptUi.md)<`TMounted`>

Source: [packages/wxt/src/utils/content-script-ui/iframe.ts:14](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/iframe.ts#L14)

Create a content script UI using an iframe.

## Type Parameters

### TMounted

`TMounted`

## Parameters

### ctx

[`ContentScriptContext`](../../../content-script-context/classes/ContentScriptContext.md)

### options

[`IframeContentScriptUiOptions`](../interfaces/IframeContentScriptUiOptions.md)<`TMounted`>

Iframe options. See [ContentScriptUiOptions](../../types/type-aliases/ContentScriptUiOptions.md) for shared
positioning, anchoring, `append`, and removal options.

## Returns

[`IframeContentScriptUi`](../interfaces/IframeContentScriptUi.md)<`TMounted`>

## See

https://wxt.dev/guide/essentials/content-scripts.html#iframe

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
