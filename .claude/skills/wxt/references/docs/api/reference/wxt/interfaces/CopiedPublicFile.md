<!-- source: https://wxt.dev/api/reference/wxt/interfaces/CopiedPublicFile.md -->
[API](../../packages.md) / [wxt](../index.md) / CopiedPublicFile

# Interface: CopiedPublicFile

Source: [packages/wxt/src/types.ts:1900](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1900)

## Contents

* [Extends](#extends)
* [Properties](#properties)
  * [absoluteSrc](#absolutesrc)
  * [relativeDest](#relativedest)

## Extends

* [`ResolvedBasePublicFile`](ResolvedBasePublicFile.md)

## Properties

### absoluteSrc

> **absoluteSrc**: `string`

Source: [packages/wxt/src/types.ts:1907](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1907)

The absolute path to the file that will be copied to the output directory.

#### Example

```ts
'/path/to/any/file.css';
```

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
