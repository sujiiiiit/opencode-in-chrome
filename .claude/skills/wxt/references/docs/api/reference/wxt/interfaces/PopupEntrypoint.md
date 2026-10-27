<!-- source: https://wxt.dev/api/reference/wxt/interfaces/PopupEntrypoint.md -->
[API](../../packages.md) / [wxt](../index.md) / PopupEntrypoint

# Interface: PopupEntrypoint

Source: [packages/wxt/src/types.ts:972](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L972)

## Contents

* [Extends](#extends)
* [Properties](#properties)
  * [inputPath](#inputpath)
  * [name](#name)
  * [options](#options)
  * [outputDir](#outputdir)
  * [skipped?](#skipped)
  * [type](#type)

## Extends

* [`BaseEntrypoint`](BaseEntrypoint.md)

## Properties

### inputPath

> **inputPath**: `string`

Source: [packages/wxt/src/types.ts:924](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L924)

Absolute path to the entrypoint's input file.

#### Inherited from

[`BaseEntrypoint`](BaseEntrypoint.md).[`inputPath`](BaseEntrypoint.md#inputpath)

***

### name

> **name**: `string`

Source: [packages/wxt/src/types.ts:922](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L922)

The entrypoint's name. This is the filename or dirname without the type
suffix.

Examples:

* `popup.html` → `popup`
* `options/index.html` → `options`
* `named.sandbox.html` → `named`
* `named.sandbox/index.html` → `named`
* `sandbox.html` → `sandbox`
* `sandbox/index.html` → `sandbox`
* `overlay.content.ts` → `overlay`
* `overlay.content/index.ts` → `overlay`

The name is used when generating an output file:
`<entrypoint.outputDir>/<entrypoint.name>.<ext>`

#### Inherited from

[`BaseEntrypoint`](BaseEntrypoint.md).[`name`](BaseEntrypoint.md#name)

***

### options

> **options**: [`ResolvedPerBrowserOptions`](../type-aliases/ResolvedPerBrowserOptions.md)<[`PopupEntrypointOptions`](PopupEntrypointOptions.md), `"defaultIcon"`>

Source: [packages/wxt/src/types.ts:974](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L974)

***

### outputDir

> **outputDir**: `string`

Source: [packages/wxt/src/types.ts:929](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L929)

Absolute path to the entrypoint's output directory. Can be
`wxt.config.outDir` or a subdirectory of it.

#### Inherited from

[`BaseEntrypoint`](BaseEntrypoint.md).[`outputDir`](BaseEntrypoint.md#outputdir)

***

### skipped?

> `optional` **skipped?**: `boolean`

Source: [packages/wxt/src/types.ts:938](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L938)

When true, the entrypoint will not be built by WXT. Normally this is set
based on the `filterEntrypoints` config or the entrypoint's
`include`/`exclude` options defined inside the file.

See
https://wxt.dev/guide/essentials/target-different-browsers.html#filtering-entrypoints

#### Inherited from

[`BaseEntrypoint`](BaseEntrypoint.md).[`skipped`](BaseEntrypoint.md#skipped)

***

### type

> **type**: `"popup"`

Source: [packages/wxt/src/types.ts:973](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L973)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
