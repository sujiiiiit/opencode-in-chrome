<!-- source: https://wxt.dev/api/reference/wxt/interfaces/GeneratedPublicFile.md -->
[API](../../packages.md) / [wxt](../index.md) / GeneratedPublicFile

# Interface: GeneratedPublicFile

Source: [packages/wxt/src/types.ts:1910](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1910)

## Contents

* [Extends](#extends)
* [Properties](#properties)
  * [contents](#contents)
  * [relativeDest](#relativedest)

## Extends

* [`ResolvedBasePublicFile`](ResolvedBasePublicFile.md)

## Properties

### contents

> **contents**: `string`

Source: [packages/wxt/src/types.ts:1912](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1912)

Text to write to the file.

***

### relativeDest

> **relativeDest**: `string`

Source: [packages/wxt/src/types.ts:1897](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1897)

The relative path in the output directory to copy the file to.

#### Example

```ts
'content-scripts/base-styles.css';
```

#### Inherited from

[`ResolvedBasePublicFile`](ResolvedBasePublicFile.md).[`relativeDest`](ResolvedBasePublicFile.md#relativedest)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
