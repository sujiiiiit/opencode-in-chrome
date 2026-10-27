<!-- source: https://wxt.dev/api/reference/wxt/interfaces/WxtDirFileEntry.md -->
[API](../../packages.md) / [wxt](../index.md) / WxtDirFileEntry

# Interface: WxtDirFileEntry

Source: [packages/wxt/src/types.ts:1940](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1940)

Represents a file to be written to the project's `.wxt/` directory.

## Contents

* [Properties](#properties)
  * [path](#path)
  * [text](#text)
  * [tsReference?](#tsreference)

## Properties

### path

> **path**: `string`

Source: [packages/wxt/src/types.ts:1945](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1945)

Path relative to the `.wxt/` directory. So "tsconfig.json" would resolve to
".wxt/tsconfig.json".

***

### text

> **text**: `string`

Source: [packages/wxt/src/types.ts:1947](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1947)

The text that will be written to the file.

***

### tsReference?

> `optional` **tsReference?**: `boolean`

Source: [packages/wxt/src/types.ts:1949](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1949)

Set to `true` to add a reference to this file in `.wxt/wxt.d.ts`.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
