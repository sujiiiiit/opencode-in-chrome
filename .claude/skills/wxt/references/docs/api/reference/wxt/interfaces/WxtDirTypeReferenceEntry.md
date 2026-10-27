<!-- source: https://wxt.dev/api/reference/wxt/interfaces/WxtDirTypeReferenceEntry.md -->
[API](../../packages.md) / [wxt](../index.md) / WxtDirTypeReferenceEntry

# Interface: WxtDirTypeReferenceEntry

Source: [packages/wxt/src/types.ts:1930](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1930)

Represents type reference to a node module to be added to `.wxt/wxt.d.ts`
file

## Properties

### module

> **module**: `string`

Source: [packages/wxt/src/types.ts:1936](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1936)

Specifies the module name that will be used in the `/// <reference
types="..." />` directive. This value will be added to the `.wxt/wxt.d.ts`
file to include type definitions from the specified module.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
