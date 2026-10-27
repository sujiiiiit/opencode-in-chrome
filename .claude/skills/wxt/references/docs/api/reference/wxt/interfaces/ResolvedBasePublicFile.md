<!-- source: https://wxt.dev/api/reference/wxt/interfaces/ResolvedBasePublicFile.md -->
[API](../../packages.md) / [wxt](../index.md) / ResolvedBasePublicFile

# Interface: ResolvedBasePublicFile

Source: [packages/wxt/src/types.ts:1890](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1890)

## Contents

* [Extended by](#extended-by)
* [Properties](#properties)
  * [relativeDest](#relativedest)

## Extended by

* [`CopiedPublicFile`](CopiedPublicFile.md)
* [`GeneratedPublicFile`](GeneratedPublicFile.md)

## Properties

### relativeDest

> **relativeDest**: `string`

Source: [packages/wxt/src/types.ts:1897](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1897)

The relative path in the output directory to copy the file to.

#### Example

```ts
'content-scripts/base-styles.css';
```

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
