<!-- source: https://wxt.dev/api/reference/wxt/modules/functions/addEntrypoint.md -->
[API](../../../packages.md) / [wxt/modules](../index.md) / addEntrypoint

# Function: addEntrypoint()

> **addEntrypoint**(`wxt`, `entrypoint`): `void`

Source: [packages/wxt/src/modules/index.ts:56](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/modules/index.ts#L56)

Adds a TS/JS file as an entrypoint to the project. This file will be bundled
along with the other entrypoints.

If you're publishing the module to NPM, you should probably pre-build the
entrypoint and use `addPublicAssets` instead to copy pre-bundled assets into
the output directory. This will speed up project builds since it just has to
copy some files instead of bundling them.

To extract entrypoint options from a JS/TS file, use
`wxt.builder.importEntrypoint` (see example).

## Parameters

### wxt

[`Wxt`](../../interfaces/Wxt.md)

The wxt instance provided by the module's setup function.

### entrypoint

[`Entrypoint`](../../type-aliases/Entrypoint.md)

The entrypoint to be bundled along with the extension.

## Returns

`void`

## Example

```ts
export default defineWxtModule(async (wxt, options) => {
    const entrypointPath = '/path/to/my-entrypoint.ts';
    addEntrypoint(wxt, {
      type: 'content-script',
      name: 'some-name',
      inputPath: entrypointPath,
      outputDir: wxt.config.outDir,
      options: await wxt.builder.importEntrypoint(entrypointPath),
    });
  });
```

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
