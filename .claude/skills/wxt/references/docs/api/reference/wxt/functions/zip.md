<!-- source: https://wxt.dev/api/reference/wxt/functions/zip.md -->
[API](../../packages.md) / [wxt](../index.md) / zip

# Function: zip()

> **zip**(`config?`): `Promise`<`string`\[]>

Source: [packages/wxt/src/zip.ts:21](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/zip.ts#L21)

Build and zip the extension for distribution.

## Parameters

### config?

[`InlineConfig`](../interfaces/InlineConfig.md)

Optional config that will override your `<root>/wxt.config.ts`.

## Returns

`Promise`<`string`\[]>

A list of all files included in the ZIP.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
