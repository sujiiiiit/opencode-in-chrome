<!-- source: https://wxt.dev/api/reference/wxt/functions/clean.md -->
[API](../../packages.md) / [wxt](../index.md) / clean

# Function: clean()

> **clean**(`config?`): `Promise`<`void`>

Source: [packages/wxt/src/clean.ts:16](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/clean.ts#L16)

Remove generated/temp files from the directory.

## Parameters

### config?

[`InlineConfig`](../interfaces/InlineConfig.md)

Optional config that will override your `<root>/wxt.config.ts`.

## Returns

`Promise`<`void`>

## Example

```ts
await clean();
```

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
