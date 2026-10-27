<!-- source: https://wxt.dev/api/reference/wxt/interfaces/EntrypointFinder.md -->
[API](../../packages.md) / [wxt](../index.md) / EntrypointFinder

# Interface: EntrypointFinder

Source: [packages/wxt/src/types.ts:1952](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1952)

## Methods

### findEntrypoints()

> **findEntrypoints**(): [`EntrypointInfo`](EntrypointInfo.md)\[] | `Promise`<[`EntrypointInfo`](EntrypointInfo.md)\[]>

Source: [packages/wxt/src/types.ts:1957](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1957)

#### Returns

[`EntrypointInfo`](EntrypointInfo.md)\[] | `Promise`<[`EntrypointInfo`](EntrypointInfo.md)\[]>

A list of file paths (absolute or relative to
`wxt.config.rootDir`) to load as entrypoints for.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
