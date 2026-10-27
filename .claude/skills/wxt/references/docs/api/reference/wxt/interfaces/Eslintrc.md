<!-- source: https://wxt.dev/api/reference/wxt/interfaces/Eslintrc.md -->
[API](../../packages.md) / [wxt](../index.md) / Eslintrc

# Interface: Eslintrc

Source: [packages/wxt/src/types.ts:1731](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1731)

## Contents

* [Properties](#properties)
  * [enabled?](#enabled)
  * [filePath?](#filepath)
  * [globalsPropValue?](#globalspropvalue)

## Properties

### enabled?

> `optional` **enabled?**: `boolean` | [`EslintConfigVersion`](../type-aliases/EslintConfigVersion.md) | `"auto"`

Source: [packages/wxt/src/types.ts:1745](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1745)

Determines if and in what format a config file will be generated to inform
ESLint of unimport globals.

* `true`: If eslint is installed, generate a compatible config file based on
  the installed version.
* `false`: Never generate the file.
* `8`: Generate an eslintrc file compatible with ESLint \&lte; 8.
* `9`: Generate a flat config file compatible with ESLint \&gte; 9.
* `'auto'` (Deprecated): Same as `true`.

#### Default

```ts
true
```

***

### filePath?

> `optional` **filePath?**: `string`

Source: [packages/wxt/src/types.ts:1754](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1754)

File path to save the generated eslint config.

Default depends on version of ESLint used:

* \&gte; 9: './.wxt/eslint-auto-imports.mjs'
* \&lte; 8: './.wxt/eslintrc-auto-import.json'

***

### globalsPropValue?

> `optional` **globalsPropValue?**: [`EslintGlobalsPropValue`](../type-aliases/EslintGlobalsPropValue.md)

Source: [packages/wxt/src/types.ts:1756](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1756)

#### Default

```ts
true
```

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
