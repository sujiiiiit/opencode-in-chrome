<!-- source: https://wxt.dev/api/reference/wxt/type-aliases/WxtResolvedUnimportOptions.md -->
[API](../../packages.md) / [wxt](../index.md) / WxtResolvedUnimportOptions

# Type Alias: WxtResolvedUnimportOptions

> **WxtResolvedUnimportOptions** = `Partial`<`UnimportOptions`> & `object`

Source: [packages/wxt/src/types.ts:1800](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1800)

## Type Declaration

### disabled

> **disabled**: `boolean`

Set to `true` when the user disabled auto-imports. We still use unimport
for the #imports module, but other features should be disabled.

You don't need to check this value before modifying the auto-import
options. Even if `disabled` is `true`, there's no harm in adding imports to
the config - they'll just be ignored.

### eslintrc

> **eslintrc**: [`ResolvedEslintrc`](../interfaces/ResolvedEslintrc.md)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
