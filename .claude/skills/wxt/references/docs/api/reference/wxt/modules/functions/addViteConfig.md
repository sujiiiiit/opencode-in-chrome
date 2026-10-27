<!-- source: https://wxt.dev/api/reference/wxt/modules/functions/addViteConfig.md -->
[API](../../../packages.md) / [wxt/modules](../index.md) / addViteConfig

# Function: addViteConfig()

> **addViteConfig**(`wxt`, `viteConfig`): `void`

Source: [packages/wxt/src/modules/index.ts:109](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/modules/index.ts#L109)

Merge additional vite config for one or more entrypoint "groups" that make up
individual builds. Config in the project's `wxt.config.ts` file takes
precedence over any config added by this function.

## Parameters

### wxt

[`Wxt`](../../interfaces/Wxt.md)

The wxt instance provided by the module's setup function.

### viteConfig

(`env`) => `UserConfig` | `undefined`

A function that returns the vite config the module is
adding. Same format as `vite` in `wxt.config.ts`.

## Returns

`void`

## Example

```ts
export default defineWxtModule((wxt, options) => {
  addViteConfig(wxt, () => ({
  build: {
  sourceMaps: true,
  },
  });
  });
```

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
