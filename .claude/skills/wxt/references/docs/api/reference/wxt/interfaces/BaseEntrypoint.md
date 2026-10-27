<!-- source: https://wxt.dev/api/reference/wxt/interfaces/BaseEntrypoint.md -->
[API](../../packages.md) / [wxt](../index.md) / BaseEntrypoint

# Interface: BaseEntrypoint

Source: [packages/wxt/src/types.ts:903](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L903)

## Contents

* [Extended by](#extended-by)
* [Properties](#properties)
  * [inputPath](#inputpath)
  * [name](#name)
  * [outputDir](#outputdir)
  * [skipped?](#skipped)

## Extended by

* [`GenericEntrypoint`](GenericEntrypoint.md)
* [`UnlistedScriptEntrypoint`](UnlistedScriptEntrypoint.md)
* [`BackgroundEntrypoint`](BackgroundEntrypoint.md)
* [`ContentScriptEntrypoint`](ContentScriptEntrypoint.md)
* [`PopupEntrypoint`](PopupEntrypoint.md)
* [`OptionsEntrypoint`](OptionsEntrypoint.md)
* [`SidepanelEntrypoint`](SidepanelEntrypoint.md)

## Properties

### inputPath

> **inputPath**: `string`

Source: [packages/wxt/src/types.ts:924](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L924)

Absolute path to the entrypoint's input file.

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

***

### outputDir

> **outputDir**: `string`

Source: [packages/wxt/src/types.ts:929](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L929)

Absolute path to the entrypoint's output directory. Can be
`wxt.config.outDir` or a subdirectory of it.

***

### skipped?

> `optional` **skipped?**: `boolean`

Source: [packages/wxt/src/types.ts:938](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L938)

When true, the entrypoint will not be built by WXT. Normally this is set
based on the `filterEntrypoints` config or the entrypoint's
`include`/`exclude` options defined inside the file.

See
https://wxt.dev/guide/essentials/target-different-browsers.html#filtering-entrypoints

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
