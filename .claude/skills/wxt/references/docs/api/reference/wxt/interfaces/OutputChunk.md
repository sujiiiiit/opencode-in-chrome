<!-- source: https://wxt.dev/api/reference/wxt/interfaces/OutputChunk.md -->
[API](../../packages.md) / [wxt](../index.md) / OutputChunk

# Interface: OutputChunk

Source: [packages/wxt/src/types.ts:554](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L554)

## Contents

* [Properties](#properties)
  * [fileName](#filename)
  * [moduleIds](#moduleids)
  * [type](#type)

## Properties

### fileName

> **fileName**: `string`

Source: [packages/wxt/src/types.ts:561](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L561)

Relative, normalized path relative to the output directory.

Ex: "content-scripts/overlay.js"

***

### moduleIds

> **moduleIds**: `string`\[]

Source: [packages/wxt/src/types.ts:563](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L563)

Absolute, normalized paths to all dependencies this chunk relies on.

***

### type

> **type**: `"chunk"`

Source: [packages/wxt/src/types.ts:555](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L555)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
