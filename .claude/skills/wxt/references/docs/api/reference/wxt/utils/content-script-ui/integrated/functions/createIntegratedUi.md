<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-ui/integrated/functions/createIntegratedUi.md -->
[API](../../../../../packages.md) / [wxt/utils/content-script-ui/integrated](../index.md) / createIntegratedUi

# Function: createIntegratedUi()

> **createIntegratedUi**<`TMounted`>(`ctx`, `options`): [`IntegratedContentScriptUi`](../interfaces/IntegratedContentScriptUi.md)<`TMounted`>

Source: [packages/wxt/src/utils/content-script-ui/integrated.ts:13](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/content-script-ui/integrated.ts#L13)

Create a content script UI without any isolation.

## Type Parameters

### TMounted

`TMounted`

## Parameters

### ctx

[`ContentScriptContext`](../../../content-script-context/classes/ContentScriptContext.md)

### options

[`IntegratedContentScriptUiOptions`](../interfaces/IntegratedContentScriptUiOptions.md)<`TMounted`>

Integrated UI options. See [ContentScriptUiOptions](../../types/type-aliases/ContentScriptUiOptions.md) for
shared positioning, anchoring, `append`, and removal options.

## Returns

[`IntegratedContentScriptUi`](../interfaces/IntegratedContentScriptUi.md)<`TMounted`>

## See

https://wxt.dev/guide/essentials/content-scripts.html#integrated

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
