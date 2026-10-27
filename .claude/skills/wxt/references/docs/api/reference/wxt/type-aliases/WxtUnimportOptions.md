<!-- source: https://wxt.dev/api/reference/wxt/type-aliases/WxtUnimportOptions.md -->
[API](../../packages.md) / [wxt](../index.md) / WxtUnimportOptions

# Type Alias: WxtUnimportOptions

> **WxtUnimportOptions** = `Partial`<`UnimportOptions`> & `object`

Source: [packages/wxt/src/types.ts:1767](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1767)

## Type Declaration

### eslintrc?

> `optional` **eslintrc?**: [`Eslintrc`](../interfaces/Eslintrc.md)

When using ESLint, auto-imported variables are linted as "undeclared
globals". This option lets you configure a base eslintrc that, when
extended, fixes these lint errors.

See
<https://wxt.dev/guide/essentials/config/auto-imports.html#eslint>

### scan?

> `optional` **scan?**: `boolean`

Set to `false` to stop WXT from scanning its default auto-import
directories (`components`, `composables`, `hooks`, and `utils`, relative to
`srcDir`). Preset/library based imports (from `imports` and `presets`) are
unaffected.

Combine with `dirs` to replace the default directories with your own,
instead of extending them:

```ts
export default defineConfig({
  imports: {
    scan: false,
    dirs: ['some-directory'],
  },
});
```

#### Default

```ts
true
```

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
