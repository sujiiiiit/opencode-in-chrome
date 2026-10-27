<!-- source: https://wxt.dev/api/reference/wxt/functions/build.md -->
[API](../../packages.md) / [wxt](../index.md) / build

# Function: build()

> **build**(`config?`): `Promise`<[`BuildOutput`](../interfaces/BuildOutput.md)>

Source: [packages/wxt/src/build.ts:19](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/build.ts#L19)

Bundles the extension for production. Returns a promise of the build result.
Discovers the `wxt.config.ts` file in the root directory, and merges that
config with what is passed in.

## Parameters

### config?

[`InlineConfig`](../interfaces/InlineConfig.md)

## Returns

`Promise`<[`BuildOutput`](../interfaces/BuildOutput.md)>

## Example

```ts
// Use config from `wxt.config.ts`
  const res = await build();

  // or override config `from wxt.config.ts`
  const res = await build({
    // Override config...
  });
```

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
