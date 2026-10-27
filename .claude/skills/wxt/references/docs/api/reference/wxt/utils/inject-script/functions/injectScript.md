<!-- source: https://wxt.dev/api/reference/wxt/utils/inject-script/functions/injectScript.md -->
[API](../../../../packages.md) / [wxt/utils/inject-script](../index.md) / injectScript

# Function: injectScript()

> **injectScript**(`path`, `options?`): `Promise`<[`InjectScriptResult`](../interfaces/InjectScriptResult.md)>

Source: [packages/wxt/src/utils/inject-script.ts:21](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/inject-script.ts#L21)

This function can only be called inside content scripts.

Inject an unlisted script into the page. Scripts are added to the `<head>`
element or `document.documentElement` if there is no head.

Make sure to add the injected script to your manifest's
`web_accessible_resources`.

## Parameters

### path

`any`

### options?

[`InjectScriptOptions`](../interfaces/InjectScriptOptions.md)

## Returns

`Promise`<[`InjectScriptResult`](../interfaces/InjectScriptResult.md)>

A result object containing the created script element.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
