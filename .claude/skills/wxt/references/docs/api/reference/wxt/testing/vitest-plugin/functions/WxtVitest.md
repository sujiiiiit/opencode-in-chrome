<!-- source: https://wxt.dev/api/reference/wxt/testing/vitest-plugin/functions/WxtVitest.md -->
[API](../../../../packages.md) / [wxt/testing/vitest-plugin](../index.md) / WxtVitest

# Function: WxtVitest()

> **WxtVitest**(`inlineConfig?`): `Promise`<`PluginOption`\[]>

Source: [packages/wxt/src/testing/wxt-vitest-plugin.ts:36](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/testing/wxt-vitest-plugin.ts#L36)

Vite plugin that configures Vitest with everything required to test a WXT
extension, based on the `<root>/wxt.config.ts`

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
});
```

## Parameters

### inlineConfig?

[`InlineConfig`](../../../interfaces/InlineConfig.md)

Customize WXT's config for testing. Any config specified
here overrides the config from your `wxt.config.ts` file.

## Returns

`Promise`<`PluginOption`\[]>

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
