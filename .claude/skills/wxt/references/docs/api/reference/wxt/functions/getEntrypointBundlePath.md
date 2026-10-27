<!-- source: https://wxt.dev/api/reference/wxt/functions/getEntrypointBundlePath.md -->
[API](../../packages.md) / [wxt](../index.md) / getEntrypointBundlePath

# Function: getEntrypointBundlePath()

> **getEntrypointBundlePath**(`entrypoint`, `outDir`, `ext`): `string`

Source: [packages/wxt/src/internal-utils/entrypoint-utils.ts:33](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/internal-utils/entrypoint-utils.ts#L33)

Return's the entrypoint's output path relative to the output directory. Used
for paths in the manifest and rollup's bundle.

## Parameters

### entrypoint

[`Entrypoint`](../type-aliases/Entrypoint.md)

### outDir

`string`

### ext

`string`

## Returns

`string`

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
