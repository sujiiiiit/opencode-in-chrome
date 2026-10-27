<!-- source: https://wxt.dev/api/reference/wxt/modules/functions/addPublicAssets.md -->
[API](../../../packages.md) / [wxt/modules](../index.md) / addPublicAssets

# Function: addPublicAssets()

> **addPublicAssets**(`wxt`, `dir`): `void`

Source: [packages/wxt/src/modules/index.ts:75](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/modules/index.ts#L75)

Copy files inside a directory (as if it were the public directory) into the
extension's output directory. The directory itself is not copied, just the
files inside it. If a filename matches an existing one, it is ignored.

## Parameters

### wxt

[`Wxt`](../../interfaces/Wxt.md)

The wxt instance provided by the module's setup function.

### dir

`string`

The directory to copy.

## Returns

`void`

## Example

```ts
export default defineWxtModule((wxt, options) => {
    addPublicAssets(wxt, './dist/prebundled');
  });
```

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
