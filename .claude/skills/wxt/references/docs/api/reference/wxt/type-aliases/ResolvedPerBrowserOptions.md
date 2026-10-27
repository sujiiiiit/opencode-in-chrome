<!-- source: https://wxt.dev/api/reference/wxt/type-aliases/ResolvedPerBrowserOptions.md -->
[API](../../packages.md) / [wxt](../index.md) / ResolvedPerBrowserOptions

# Type Alias: ResolvedPerBrowserOptions\<T, TOmitted>

> **ResolvedPerBrowserOptions**<`T`, `TOmitted`> = `{ [key in keyof Omit<T, TOmitted>]: T[key] extends PerBrowserOption<infer U> ? U : T[key] }` & `{ [key in TOmitted]: T[key] }`

Source: [packages/wxt/src/types.ts:1066](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1066)

Convert `{ key: PerBrowserOption<T> }` to just `{ key: T }`, stripping away
the `PerBrowserOption` type for all fields inside the object.

A optional second list of keys can be passed if a field isn't compatible with
`PerBrowserOption`, like `defaultIcon`.

## Type Parameters

### T

`T`

### TOmitted

`TOmitted` *extends* keyof `T` = `never`

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
